import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/kadira:flow-router';

import {ConfirmationDialogFactory} from '../../helpers/confirmationDialogFactory';

import { MeetingSeries } from '/imports/meetingseries';
import { UsersEditConfig } from './meetingSeriesEditUsers';
import { UserRoles } from '/imports/userroles';
import { MinutesFinder } from "/imports/services/minutesFinder";


Template.meetingSeriesEdit.onCreated(function() {
    let thisMeetingSeriesID = FlowRouter.getParam('_id');

    // create client-only collection for storage of users attached
    // to this meeting series as input <=> output for the user editor
    let _attachedUsersCollection = new Mongo.Collection(null);

    // build editor config and attach it to the instance of the template
    this.userEditConfig = new UsersEditConfig(
        true,                                               // current user can not be edited
        thisMeetingSeriesID,                                // the meeting series id
        _attachedUsersCollection);                          // collection of attached users

    // Hint: collection will be filled in the "show.bs.modal" event below
});

Template.meetingSeriesEdit.helpers({
    users: function () {
        return Meteor.users.find({});
    },

    userEditConfig: function () {
        return Template.instance().userEditConfig;
    },

    labelsConfig: function() {
        return {
            meetingSeriesId: this._id
        };
    }
});

Template.meetingSeriesEdit.events({

    'click #deleteMeetingSeries': function() {
        console.log('Remove Meeting Series: '+this._id);
        $('#dlgEditMeetingSeries').modal('hide');   // hide underlying modal dialog first, otherwise transparent modal layer is locked!

        let ms = new MeetingSeries(this._id);
        let minutesCount = ms.countMinutes();

        let deleteSeriesCallback = () => {
            MeetingSeries.remove(ms);
            FlowRouter.go('/');
        };

        ConfirmationDialogFactory.makeWarningDialogWithTemplate(
            deleteSeriesCallback,
            'Confirm delete',
            'confirmationDialogDeleteSeries',
            {
                project: ms.project,
                name: ms.name,
                hasMinutes: (minutesCount !== 0),
                minutesCount: minutesCount,
                lastMinutesDate: (minutesCount !== 0) ? MinutesFinder.lastMinutesOfMeetingSeries(ms).date : false
            }
        ).show();
    },


    // "show" event is fired shortly before BootStrap modal dialog will pop up
    // We fill the temp. client-side only user database for the user editor on this event
    'show.bs.modal #dlgEditMeetingSeries': function (evt, tmpl) {
        // Make sure these init values are filled in a close/re-open scenario
        $('#btnMeetingSeriesSave').prop('disabled',false);
        $('#btnMeetinSeriesEditCancel').prop('disabled',false);
        tmpl.find('#id_meetingproject').value = this.project;
        tmpl.find('#id_meetingname').value = this.name;

        Template.instance().userEditConfig.users.remove({});    // first: clean up everything!

        // copy all attached users of this series to the temp. client-side user collection
        // and save their original _ids for later reference
        for (let i in this.visibleFor) {
            let user = Meteor.users.findOne(this.visibleFor[i]);
            user._idOrg = user._id;
            delete user._id;
            Template.instance().userEditConfig.users.insert(user);
        }
        // now the same for the informed users
        for (let i in this.informedUsers) {
            let user = Meteor.users.findOne(this.informedUsers[i]);
            user._idOrg = user._id;
            delete user._id;
            Template.instance().userEditConfig.users.insert(user);
        }
    },

    'shown.bs.modal #dlgEditMeetingSeries': function (evt, tmpl) {
        // switch to "invited users" tab once, if desired
        if (Session.get('meetingSeriesEdit.showUsersPanel') === true) {
            Session.set('meetingSeriesEdit.showUsersPanel', false);
            $('#btnShowHideInvitedUsers').click();
            Meteor.setTimeout(function () {
                tmpl.find('#edt_AddUser').focus();
            }, 500);

        } else {
            $('#dlgEditMeetingSeries input').trigger('change');   // ensure new values trigger placeholder animation
            tmpl.find('#id_meetingproject').focus();
        }
    },

    'submit #frmDlgEditMeetingSeries': function(evt, tmpl) {
        evt.preventDefault();
        let saveButton = $('#btnMeetingSeriesSave');
        let cancelButton = $('btnMeetinSeriesEditCancel');
        saveButton.prop('disabled',true);
        cancelButton.prop('disabled',true);

        let aProject = tmpl.find('#id_meetingproject').value;
        let aName = tmpl.find('#id_meetingname').value;

        // validate form and show errors - necessary for browsers which do not support form-validation
        let projectNode = tmpl.$('#id_meetingproject');
        let nameNode = tmpl.$('#id_meetingname');
        projectNode.parent().removeClass('has-error');
        nameNode.parent().removeClass('has-error');
        if (aProject === '') {
            projectNode.parent().addClass('has-error');
            projectNode.focus();
            return;
        }
        if (aName === '') {
            nameNode.parent().addClass('has-error');
            nameNode.focus();
            return;
        }

        let usersWithRolesAfterEdit = Template.instance().userEditConfig.users.find().fetch();
        let allVisiblesArray = [];
        let allInformedArray = [];
        let meetingSeriesId = this._id;
        for (let i in usersWithRolesAfterEdit) {
            let usrAfterEdit = usersWithRolesAfterEdit[i];
            let ur = new UserRoles(usrAfterEdit._idOrg);     // Attention: get back to Id of Meteor.users collection
            ur.saveRoleForMeetingSeries(meetingSeriesId, usrAfterEdit.roles[meetingSeriesId]);
            if (UserRoles.isVisibleRole(usrAfterEdit.roles[meetingSeriesId])) {
                allVisiblesArray.push(usrAfterEdit._idOrg);  // Attention: get back to Id of Meteor.users collection
            } else {
                allInformedArray.push(usrAfterEdit._idOrg);  // Attention: get back to Id of Meteor.users collection
            }
        }

        ms = new MeetingSeries(meetingSeriesId);
        ms.project = aProject;
        ms.name = aName;
        ms.setVisibleAndInformedUsers(allVisiblesArray,allInformedArray);   // this also removes the roles of removed users
        ms.save();

        // Hide modal dialog
        saveButton.prop('disabled',false);
        cancelButton.prop('disabled',false);
        $('#dlgEditMeetingSeries').modal('hide');
    },


    'click #btnMeetingSeriesSave': function (evt, tmpl) {
        evt.preventDefault();
        // Unfortunately the form.submit()-function does not trigger the
        // validation process
        tmpl.$('#submitMeetingSeriesEditForm').click();
    },

    // Prevent the last open panel to be collapsible
    'click .panel-heading a': function (evt) {
        if($(evt.target).parents('.panel').children('.panel-collapse').hasClass('in')){
            evt.stopPropagation();
        }
        evt.preventDefault();
    }
});
