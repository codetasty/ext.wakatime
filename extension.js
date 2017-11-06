/* global define, $, config */
"use strict";

define(function(require, exports, module) {
	const ExtensionManager = require('core/extensionManager');
	const Notification = require('core/notification');
	const Workspace = require('core/workspace');
	
	const HomeSettings = require('modules/home/ext/settings');
	
	const EditorSession = require('modules/editor/ext/session');
	const EditorEditors = require('modules/editor/ext/editors');
	
	class Extension extends ExtensionManager.Extension {
		constructor() {
			super({
				name: 'wakatime',
				settings: {
					apikey: '',
				},
			});
			
			this._lastAction = 0;
			this._lastFile = null;
			this._lastProject = null;
			
			// bind event handlers
			this.onFocus = this.onFocus.bind(this);
			this.onSave = this.onSave.bind(this);
			this.onChange = this.onChange.bind(this);
		}
		
		
		init() {
			super.init();
			
			var self = this;
			
			HomeSettings.add(this.name, {
				label: 'WakaTime',
				icon: require('text!./menu.svg'),
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
		}
		
		destroy() {
			super.destroy();
			
			HomeSettings.remove(this.name);
			
			EditorSession.off('focus', this.onFocus);
			EditorSession.off('save', this.onFocus);
			EditorSession.off('session.change', this.onChange);
		}
		
		getApiKey() {
			return this.settings.apikey;
		}
		
		onFocus(session) {
			this.handleAction(false, session);
		}
		
		onSave(session) {
			this.handleAction(true, session);
		}
		
		onChange(session) {
			this.handleAction(false, session);
		}
		
		sendHeartbeat(file, time, workspace, language, isWrite, lines) {
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
					plugin: 'codetasty-wakatime/' + this.version,
				})
			});
			this._lastAction = time;
			this._lastFile = file;
			this._lastProject = workspace ? workspace.id : null;
		}
		
		enoughTimePassed() {
			return this._lastAction + 120000 < Date.now();
		}
		
		handleAction(isWrite, session) {
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
	}
	
	module.exports = new Extension();
});