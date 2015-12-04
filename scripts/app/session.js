/**
 * Created by dmitriy.ryajov on 11/26/15.
 */
'use strict';

var Q = require('q');

/**
 *
 * @constructor
 */
function Session(config) {
	this._config = config;
	this._session = {};
	this._refreshCB = null;
	this._refreshInProgress = false;
	this.storage = null;

	// Apply defaults if there is no config
	if (!this._config) {
		this.configure({});
	}
	if (this._config.storage === 'session') {
		this.storage = sessionStorage;
	} else {
		this.storage = localStorage;
	}

	// Setup the new session
	this._session = JSON.parse(this.storage.getItem('superlogin.session'));
}

/**
 *
 * @param config
 */
Session.prototype.configure = function (config) {
	config = config || {};
	config.baseUrl = config.baseUrl || '/auth/';
	if (!config.endpoints || !(config.endpoints instanceof Array)) {
		config.endpoints = [];
	}
	if (!config.noDefaultEndpoint) {
		var parser = window.document.createElement('a');
		parser.href = '/';
		config.endpoints.push(parser.host);
	}
	config.providers = config.providers || [];
	this._config = config;
};

/**
 *
 */
Session.prototype.deleteSession = function deleteSession() {
	this.storage.removeItem('superlogin.session');
	this._session = null;
};

/**
 *
 */
Session.prototype.checkExpired = function checkExpired() {
	// This is not necessary if we are not authenticated
	if (!this._session || !this._session.user_id) {
		return;
	}
	var expires = this._session.expires;
	var timeDiff = this._session.serverTimeDiff || 0;
	// Only compensate for time difference if it is greater than 5 seconds
	if (Math.abs(timeDiff) < 5000) {
		timeDiff = 0;
	}
	var estimatedServerTime = Date.now() + timeDiff;
	if (estimatedServerTime > expires) {
		deleteSession();
		//$rootScope.$broadcast('sl:logout', 'Session expired');
	}
};

/**
 *
 * @returns {boolean}
 */
Session.prototype.authenticated = function authenticated() {
	return !!(this._session && this._session.user_id);
};

/**
 *
 * @returns {*}
 */
Session.prototype.getSession = function () {
	return this._session || JSON.parse(this.storage.getItem('superlogin.session'));
};

/**
 *
 * @param session
 */
Session.prototype.setSession = function (session) {
	this._session = session;
	this.storage.setItem('superlogin.session', JSON.stringify(this._session));
};

/**
 *
 * @returns {{}|*}
 */
Session.prototype.getConfig = function () {
	return this._config;
};

/**
 *
 * @param dbName
 * @returns {*}
 */
Session.prototype.getDbUrl = function (dbName) {
	if (this._session.userDBs && this._session.userDBs[dbName]) {
		return this._session.userDBs[dbName];
	} else {
		return null;
	}
};

/**
 *
 * @param role
 * @returns {boolean}
 */
Session.prototype.confirmRole = function (role) {
	if (!this._session || !this._session.roles || !this._session.roles.length) return false;
	return this._session.roles.indexOf(role) !== -1;
};

/**
 *
 * @param roles
 * @returns {boolean}
 */
Session.prototype.confirmAnyRole = function (roles) {
	if (!this._session || !this._session.roles || !this._session.roles.length) return false;
	for (var i = 0; i < roles.length; i++) {
		if (this._session.roles.indexOf(roles[i]) !== -1) return true;
	}
};

/**
 *
 * @param roles
 * @returns {boolean}
 */
Session.prototype.confirmAllRoles = function (roles) {
	if (!this._session || !this._session.roles || !this._session.roles.length) return false;
	for (var i = 0; i < roles.length; i++) {
		if (this._session.roles.indexOf(roles[i]) === -1) return false;
	}
	return true;
};

/**
 *
 */
Session.prototype.checkRefresh = function () {
	// Get out if we are not authenticated or a refresh is already in progress
	if (this._refreshInProgress || (!this._session || !this._session.user_id)) {
		return;
	}
	var issued = this._session.issued;
	var expires = this._session.expires;
	var threshold = this._config.refreshThreshold || 0.5;
	var duration = expires - issued;
	var timeDiff = this._session.serverTimeDiff || 0;
	if (Math.abs(timeDiff) < 5000) {
		timeDiff = 0;
	}
	var estimatedServerTime = Date.now() + timeDiff;
	var elapsed = estimatedServerTime - issued;
	var ratio = elapsed / duration;
	if ((ratio > threshold) && (typeof this._refreshCB === 'function')) {
		this._refreshInProgress = true;
		return this._refreshCB()
			.then(function () {
				this._refreshInProgress = false;
			}, function () {
				this._refreshInProgress = false;
			});
	}

	return Q(this); // return resolved promise
};

/**
 *
 * @param cb
 */
Session.prototype.onRefresh = function (cb) {
	this._refreshCB = cb;
};

module.exports = Session;
