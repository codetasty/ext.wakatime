define(function(require, exports, module) {
	var ExtensionManager = require('core/extensionManager');
	var Notification = require('core/notification');
	var Workspace = require('core/workspace');
	
	var HomeSettings = require('modules/home/ext/settings');
	
	var EditorSession = require('modules/editor/ext/session');
	var EditorEditors = require('modules/editor/ext/editors');
	
	var MenuIcon = require('text!./menu.svg');
	
	var VERSION = '1.0';
	
	var Extension = ExtensionManager.register({
		name: 'wakatime',
		storage: {
			apikey: '', //9fba1291-2c33-4824-8ace-969ac53f7994
		},
		css: [
		]
	}, {
		_lastAction: 0,
		_lastFile: null,
		init: function() {
			var self = this;
			
			HomeSettings.add(this.name, {
				label: 'WakaTime',
				icon: MenuIcon,
				sections: [{
					title: 'WakaTime',
					module: this.path,
					fields: [{
						name: 'apikey',
						label: 'API Key',
						type: 'text',
						description: 'You can find your api key <a href="https://wakatime.com/settings/account?apikey=true" target="_blank">here</a>.'
					}]
				}]
			});
			
			EditorSession.on('focus', this.onFocus);
			EditorSession.on('save', this.onSave);
			EditorEditors.on('codetools.change', this.onChange);
			
			if (!this.getApiKey()) {
				var $actions = $('<ul class="actions"><li class="btn btn-confirm">Settings</li></ul>');
				
				$actions.find('.btn.btn-confirm').click(function() {
					HomeSettings.open(self.name);
					
					$(this).parents('.notification').trigger('close');
				});
				
				Notification.open({
					type: 'warning',
					title: 'WakaTime',
					description: 'Please, set you api key to start tracking.',
					html: $actions
				});
			}
		},
		destroy: function() {
			HomeSettings.remove(this.name);
			
			EditorSession.off('focus', this.onFocus);
			EditorSession.off('save', this.onFocus);
			EditorSession.off('codetools.change', this.onChange);
		},
		getApiKey: function() {
			return this.getStorage().apikey;
		},
		onFocus: function(e) {
			Extension.handleAction(false, e.storage, e.session);
		},
		onSave: function(e) {
			Extension.handleAction(true, e.storage, e.session);
		},
		onChange: function(e) {
			var id = e.id;
			
			Extension.handleAction(false, EditorSession.getStorage().sessions[id], EditorSession.sessions[id]);
		},
		sendHeartbeat: function(file, time, project, language, isWrite, lines) {
			$.ajax({
				type: 'POST',
				url: 'https://wakatime.com/api/v1/users/current/heartbeats?apikey=' + encodeURIComponent(this.getApiKey()),
				dataType: 'json',
				data: JSON.stringify({
					time: time / 1000,
					entity: file,
					type: 'file',
					project: project,
					language: language,
					is_write: isWrite ? true : false,
					lines: lines,
					plugin: 'codetasty-wakatime/' + VERSION
				})
			});
			this._lastAction = time;
			this._lastFile = file;
		},
		enoughTimePassed: function() {
			return this._lastAction + 120000 < Date.now();
		},
		handleAction: function(isWrite, storage, session) {
			if (!storage || !session || storage.type != 'file' || !this.getApiKey()) {
				return false;
			}
			
			var time = Date.now();
			
			var fullPath = storage.workspaceId + ':' + storage.path;
			
			if (isWrite || this.enoughTimePassed() || this._lastFile !== fullPath) {
				var workspace = Workspace.getFromList(storage.workspaceId);
				
				this.sendHeartbeat(fullPath, time, workspace ? workspace.name : null, session.mode, isWrite, session.data.doc.getLength());
			}
		}
	});
	
	Extension.api({
		imports: ['getApiKey']
	});

	module.exports = Extension.api();
});