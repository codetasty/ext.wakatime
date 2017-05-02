define(function(require, exports, module) {
	var ExtensionManager = require('core/extensionManager');
	var Notification = require('core/notification');
	var Workspace = require('core/workspace');
	
	var HomeSettings = require('modules/home/ext/settings');
	
	var EditorSession = require('modules/editor/ext/session');
	var EditorEditors = require('modules/editor/ext/editors');
	
	var MenuIcon = require('text!./menu.svg');
	
	var VERSION = '1.1';
	
	var Extension = ExtensionManager.register({
		name: 'wakatime',
		settings: {
			apikey: '',
		},
		css: [
		]
	}, {
		_lastAction: 0,
		_lastFile: null,
		_lastProject: null,
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
			EditorEditors.on('save', this.onSave);
			EditorEditors.on('session.change', this.onChange);
			
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
			
			this.trigger('init');
		},
		destroy: function() {
			HomeSettings.remove(this.name);
			
			EditorSession.off('focus', this.onFocus);
			EditorSession.off('save', this.onFocus);
			EditorSession.off('session.change', this.onChange);
		},
		getApiKey: function() {
			return this.settings.apikey;
		},
		onFocus: function(session) {
			Extension.handleAction(false, session);
		},
		onSave: function(session) {
			Extension.handleAction(true, session);
		},
		onChange: function(session) {
			Extension.handleAction(false, session);
		},
		sendHeartbeat: function(file, time, workspace, language, isWrite, lines) {
			$.ajax({
				type: 'POST',
				url: 'https://wakatime.com/api/v1/users/current/heartbeats?apikey=' + encodeURIComponent(this.getApiKey()),
				dataType: 'json',
				data: JSON.stringify({
					time: time / 1000,
					entity: file,
					type: 'file',
					project: workspace ? workspace.name : null,
					language: language,
					is_write: isWrite ? true : false,
					lines: lines,
					plugin: 'codetasty-wakatime/' + VERSION
				})
			});
			this._lastAction = time;
			this._lastFile = file;
			this._lastProject = workspace ? workspace.id : null;
		},
		enoughTimePassed: function() {
			return this._lastAction + 120000 < Date.now();
		},
		handleAction: function(isWrite, session) {
			if (!session.storage || session.storage.type !== 'file' || !this.getApiKey()) {
				return false;
			}
			
			var time = Date.now();
			var workspace = Workspace.get(session.storage.workspaceId);
			
			var workspaceId = workspace ? workspace.id : null;
			
			if (isWrite || this.enoughTimePassed() || this._lastFile !== session.storage.path || this._lastProject != workspaceId) {
				this.sendHeartbeat(session.storage.path, time, workspace, session.mode, isWrite, session.data.doc.getLength());
			}
		}
	});
	
	Extension.api({
		imports: ['getApiKey']
	});

	module.exports = Extension.api();
});