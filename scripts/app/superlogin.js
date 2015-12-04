/**
 * Created by dmitriy.ryajov on 11/26/15.
 */
'use strict';

var xhook = require('xhook').xhook;

var Q = require('q');
var $ = require('jquery');

var Session = require('./session');

/**
 *
 * @param config
 * @constructor
 */
function Superlogin(config) {
	Session.call(this, config);

	var self = this;

	this.oauthDeferred = null;
	this.oauthComplete = false;

	window.superlogin = {};
	// global needed by backend to complete the oauth sycle
	window.superlogin.oauthSession = function (error, session, link) {
		if (!error && session) {
			session.serverTimeDiff = session.issued - Date.now();
			self.setSession(session);
			//$rootScope.$broadcast('sl:login', session);
			self.oauthDeferred.resolve(session);
		} else if (!error && link) {
			self.oauthDeferred.resolve(capitalizeFirstLetter(link) + ' successfully linked.');
		} else {
			self.oauthDeferred.reject(error);
		}
		self.oauthComplete = true;
	};

	var parser = window.document.createElement('a');

	function requestInterceptor(request) {
		var endpoints = self.getConfig().endpoints;
		var session = self.getSession();
		if (session && session.token) {
			self.checkRefresh();
		}
		if (checkEndpoint(request.url, endpoints)) {
			if (session && session.token) {
				request.headers['Authorization'] = 'Bearer ' + session.token + ':' + session.password
			}
		}
	}

	function responseInterceptor(request, response) {
		var endpoints = self.getConfig().endpoints;
		// If there is an unauthorized error from one of our endpoints and we are logged in...
		if (checkEndpoint(request.url, endpoints) && response.status === 401 && self.authenticated()) {
			self.deleteSession();
		}
	}

	function checkEndpoint(url, endpoints) {
		parser.href = url;
		for (var i = 0; i < endpoints.length; i++) {
			if (parser.host === endpoints[i]) {
				return true;
			}
		}
		return false;
	}

	xhook.before(requestInterceptor);
	xhook.after(responseInterceptor);
}

Superlogin.prototype = Object.create(Session.prototype);
Superlogin.prototype.constructor = Superlogin;

/**
 *
 * @returns {*|promise}
 */
Superlogin.prototype.authenticate = function () {
	var deferred = Q.defer();
	var session = this.getSession();
	if (session) {
		deferred.resolve(session);
	} else {
		deferred.reject(null);
	}
	return deferred.promise;
};

/**
 *
 * @param credentials
 * @returns {*}
 */
Superlogin.prototype.login = function (credentials) {
	var self = this;
	if (!credentials.username || !credentials.password) {
		return Q.reject('Username or Password missing...');
	}
	var req = {
		method: 'POST',
		url: this.getConfig().baseUrl + 'login',
		data: JSON.stringify(credentials),
		contentType: "application/json"
	};
	return $.ajax(req)
		.then(function (res) {
			res.data.serverTimeDiff = res.data.issued - Date.now();
			self.setSession(res.data);
			return Q.when(res.data);
		}, function (err) {
			self.deleteSession();
			return Q.reject(err.data);
		});
};

/**
 *
 * @param registration
 * @returns {*}
 */
Superlogin.prototype.register = function (registration) {
	var self = this;
	var req = {
		method: 'POST',
		url: this.getConfig().baseUrl + 'register',
		data: JSON.stringify(registration),
		contentType: "application/json"
	};
	return $.ajax(req)
		.then(function (res) {
			if (res.data.user_id && res.data.token) {
				res.data.serverTimeDiff = res.data.issued - Date.now();
				self.setSession(res.data);
				// $rootScope.$broadcast('sl:login', res.data);
			}
			return Q.when(res.data);
		}, function (err) {
			return Q.reject(err.data);
		});
};

/**
 *
 * @param msg
 * @returns {*}
 */
Superlogin.prototype.logout = function (msg) {
	var self = this;
	return $.post(this.getConfig().baseUrl + 'logout', {})
		.then(function (res) {
			self.deleteSession();
			// $rootScope.$broadcast('sl:logout', msg || 'Logged out');
			return Q.when(res.data);
		}, function (err) {
			self.deleteSession();
			// $rootScope.$broadcast('sl:logout', msg || 'Logged out');
			return Q.reject(err.data);
		});
};

/**
 *
 * @param msg
 * @returns {*}
 */
Superlogin.prototype.logoutAll = function (msg) {
	var self = this;
	return $.post(this.getConfig().baseUrl + 'logout-all', {})
		.then(function (res) {
			self.deleteSession();
			// $rootScope.$broadcast('sl:logout', msg || 'Logged out');
			return Q.when(res.data);
		}, function (err) {
			self.deleteSession();
			// $rootScope.$broadcast('sl:logout', msg || 'Logged out');
			return Q.when(err.data);
		});
};

/**
 *
 * @returns {*}
 */
Superlogin.prototype.logoutOthers = function () {
	return $.post(this.getConfig().baseUrl + 'logout-others', {})
		.then(function (res) {
			return Q.when(res.data);
		}, function (err) {
			return Q.reject(err.data);
		});
};

/**
 *
 * @param provider
 * @returns {*}
 */
Superlogin.prototype.socialAuth = function (provider) {
	var providers = this.getConfig().providers;
	if (providers.indexOf(provider) === -1) {
		return Q.reject({error: 'Provider ' + provider + ' not supported.'});
	}
	return this.oAuthPopup(this.getConfig().baseUrl + provider, {windowTitle: 'Login with ' + capitalizeFirstLetter(provider)});
};

/**
 *
 * @param provider
 * @param accessToken
 * @returns {*}
 */
Superlogin.prototype.tokenSocialAuth = function (provider, accessToken) {
	var providers = this.getConfig().providers;
	if (providers.indexOf(provider) === -1) {
		return Q.reject({error: 'Provider ' + provider + ' not supported.'});
	}
	return $.post(this.getConfig().baseUrl + provider + '/token', {access_token: accessToken})
		.then(function (res) {
			if (res.data.user_id && res.data.token) {
				res.data.serverTimeDiff = res.data.issued - Date.now();
				this.setSession(res.data);
				// $rootScope.$broadcast('sl:login', res.data);
			}
			return Q.when(res.data);
		}, function (err) {
			return Q.reject(err.data);
		});
};

/**
 *
 * @param provider
 * @param accessToken
 * @returns {*}
 */
Superlogin.prototype.tokenLink = function (provider, accessToken) {
	var providers = this.getConfig().providers;
	if (providers.indexOf(provider) === -1) {
		return Q.reject({error: 'Provider ' + provider + ' not supported.'});
	}
	return $.post(this.getConfig().baseUrl + 'link/' + provider + '/token', {access_token: accessToken})
		.then(function (res) {
			return Q.when(res.data);
		}, function (err) {
			return Q.reject(err.data);
		});
};

/**
 *
 * @param provider
 * @returns {*}
 */
Superlogin.prototype.link = function (provider) {
	var providers = this.getConfig().providers;
	if (providers.indexOf(provider) === -1) {
		return Q.reject({error: 'Provider ' + provider + ' not supported.'});
	}
	if (this.authenticated()) {
		var session = this.getSession();
		var linkURL = this.getConfig().baseUrl + 'link/' + provider + '?bearer_token=' + session.token + ':' + session.password;
		return oAuthPopup(linkURL, {windowTitle: 'Link your account to ' + capitalizeFirstLetter(provider)});
	}
	return Q.reject({error: 'Authentication required'});
};

/**
 *
 * @param provider
 * @returns {*}
 */
Superlogin.prototype.unlink = function (provider) {
	var providers = this.getConfig().providers;
	if (providers.indexOf(provider) === -1) {
		return Q.reject({error: 'Provider ' + provider + ' not supported.'});
	}
	if (this.authenticated()) {
		return $.post(this.getConfig().baseUrl + 'unlink/' + provider)
			.then(function (res) {
				return Q.when(res.data);
			}, function (err) {
				return Q.reject(err.data);
			});
	}
	return Q.reject({error: 'Authentication required'});
};

/**
 *
 * @param token
 * @returns {*}
 */
Superlogin.prototype.verifyEmail = function (token) {
	if (!token || typeof token !== 'string') {
		return Q.reject({error: 'Invalid token'});
	}
	return $.get(this.getConfig().baseUrl + 'verify-email/' + token)
		.then(function (res) {
			return Q.when(res.data);
		}, function (err) {
			return Q.reject(err.data);
		});
};

/**
 *
 * @param email
 * @returns {*}
 */
Superlogin.prototype.forgotPassword = function (email) {
	return $.post(this.getConfig().baseUrl + 'forgot-password', {email: email})
		.then(function (res) {
			return Q.when(res.data);
		}, function (err) {
			return Q.reject(err.data);
		});
};

/**
 *
 * @param form
 * @returns {*}
 */
Superlogin.prototype.resetPassword = function (form) {
	var self = this;
	return $.post(this.getConfig().baseUrl + 'password-reset', form)
		.then(function (res) {
			if (res.data.user_id && res.data.token) {
				self.setSession(res.data);
				// $rootScope.$broadcast('sl:login', res.data);
			}
			return Q.when(res.data);
		}, function (err) {
			return Q.reject(err.data);
		});
};

/**
 *
 * @param form
 * @returns {*}
 */
Superlogin.prototype.changePassword = function (form) {
	if (this.authenticated()) {
		return $.post(this.getConfig().baseUrl + 'password-change', form)
			.then(function (res) {
				return Q.when(res.data);
			}, function (err) {
				return Q.reject(err.data);
			});
	}
	return Q.reject({error: 'Authentication required'});
};

/**
 *
 * @param newEmail
 * @returns {*}
 */
Superlogin.prototype.changeEmail = function (newEmail) {
	if (this.authenticated()) {
		return $.post(this.getConfig().baseUrl + 'change-email', {newEmail: newEmail})
			.then(function (res) {
				return Q.when(res.data);
			}, function (err) {
				return Q.reject(err.data);
			});
	}
	return Q.reject({error: 'Authentication required'});
};

/**
 *
 * @param username
 * @returns {*}
 */
Superlogin.prototype.validateUsername = function (username) {
	return $.get(this.getConfig().baseUrl + 'validate-username/' + encodeURIComponent(username))
		.then(function () {
			return Q.when(true);
		}, function (err) {
			if (err.status === 409) {
				return Q.reject(false);
			}
			return Q.reject(err.data);
		});
};

/**
 *
 * @param email
 * @returns {*}
 */
Superlogin.prototype.validateEmail = function (email) {
	return $.get(this.getConfig().baseUrl + 'validate-email/' + encodeURIComponent(email))
		.then(function () {
			return Q.when(true);
		}, function (err) {
			if (err.status === 409) {
				return Q.reject(false);
			}
			return Q.reject(err.data);
		});
};

Superlogin.prototype.refresh = function () {
	var session = this.getSession();
	var self = this;
	return $.post(this.getConfig().baseUrl + 'refresh', {})
		.then(function (res) {
			if (res.data.token && res.data.expires) {
				session.expires = res.data.expires;
				session.token = res.data.token;
				self.setSession(session);
				//$rootScope.$broadcast('sl:refresh', session);
				return Q.when(session);
			}
		}, function (err) {
			return Q.reject(err.data);
		});
};

Superlogin.prototype.oAuthPopup = function (url, options) {
	var self = this;
	this.oauthDeferred = Q.defer();
	this.oauthComplete = false;
	options.windowName = options.windowName || 'Social Login';
	options.windowOptions = options.windowOptions || 'location=0,status=0,width=800,height=600';
	var _oauthWindow = window.open(url, options.windowName, options.windowOptions);
	var _oauthInterval = setInterval(function () {
		if (_oauthWindow.closed) {
			clearInterval(_oauthInterval);
			if (!self.oauthComplete) {
				self.oauthDeferred.reject('Authorization cancelled');
				self.oauthComplete = true;
			}
		}
	}, 500);
	return this.oauthDeferred.promise;
};

// Capitalizes the first letter of a string
function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = Superlogin;
