import { Class as SchemaClass } from 'meteor/jagi:astronomy';
import './idValidator';

let BroadcastMessageCollection = new Mongo.Collection('broadcastmessage');

export const BroadcastMessageSchema = SchemaClass.create({
    name: 'BroadcastMessageSchema',
    collection: BroadcastMessageCollection,
    fields: {
        text: {type: String},
        isActive: {type: Boolean},
        createdAt: {type: Date},
        dismissForUserIDs: {type: [String], validators: [{type: 'meteorId'}]}
    }
});
