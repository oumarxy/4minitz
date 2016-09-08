"use strict";

let fs = require('fs'),
    mongo = require('mongodb').MongoClient,
    mongoUrl = 'mongodb://localhost:3101/meteor',
    targetDirectory = `${__dirname}/../mongodump`;

function connectToDatabase(mongoUrl) {
    return new Promise((resolve, reject) => {
        mongo.connect(mongoUrl, (error, db) => {
            if (error) {
                reject(error);
            }

            resolve(db);
        });
    });
}

function dumpCollection(collection) {
    return new Promise(resolve => {
        collection.find().toArray((error, docs) => {
            let result = { name: collection.collectionName, error, docs };
            resolve(result);
        })
    });
}

function dumpAllCollections(db) {
    let collectionsToDump = [
            'meetingSeries',
            'minutes'
        ],
        collections = collectionsToDump.map(c => db.collection(c)),
        promises = collections.map(dumpCollection);

    return Promise.all(promises);
}

function writeDumps(dumps) {
    let results = dumps.map(result => {
        return new Promise(resolve => {
            if (result.error) {
                resolve(result);
            } else {
                fs.writeFile(`${targetDirectory}/${result.name}.json`, JSON.stringify(result.docs), error => {
                    if (error) {
                        resolve({name: result.name, error});
                    } else {
                        resolve({name: result.name});
                    }
                });
            }
        });
    });

    return Promise.all(results);
}

function collectResults(results) {
    results.forEach(result => {
        if (result.error) {
            console.warn(`An error occurred while saving '${result.name}': ${result.error}`);
        } else {
            console.log(`Successfully dumped '${result.name}`);
        }
    });
}

function closeConnection(db) {
    db.close();
}

let database;
connectToDatabase(mongoUrl)
    .then(db => {
        database = db;
        return dumpAllCollections(database);
    })
    .then(writeDumps)
    .then(collectResults)
    .then(() => {
        closeConnection(database);
    })
    .catch(error => {
        console.error(error);
    });