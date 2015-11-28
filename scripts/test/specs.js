/**
 * Created by dmitriy.ryajov on 11/27/15.
 */
describe('superlogin-client', function () {

	var $q = require('q');
	var $ = require('jquery');
	var Superlogin = require('../app/superlogin');

	var config = require('./config.example.js');
	config.providers = ['friendface'];

	var testLogin = {
		username: 'superuser',
		password: 'superpass'
	};

	var response = {
		user_id: 'superuser',
		roles: ['user'],
		token: 'abc123',
		password: 'mypass',
		issued: Date.now(),
		expires: Date.now() + 10000,
		userDBs: {
			main: 'http://localhost:5984/test_main$superuser'
		}
	};

	var _time = Date.now();

	var provider;
	var superlogin;

	var $http, $window, windowOpen, $interval;

	beforeEach(function () {
		jasmine.Ajax.install();
	});

	afterEach(function () {
		jasmine.Ajax.uninstall();
	});

	beforeEach(function () {
		superlogin = new Superlogin(config);
		$http = $;
		$window = window;
		windowOpen = window.open;
		$interval = window.setInterval;
	});

	beforeEach(function () {
		localStorage.removeItem('superlogin.session');
		localStorage.removeItem('superlogin.oauth');
	});

	afterEach(function () {
		$window.open = windowOpen;
	});

	it('should have superlogin provider', function () {
		expect(superlogin).toBeDefined();
	});

	it('should have a method login()', function () {
		expect(typeof superlogin.login).toBe('function');
	});

	it('should have been configured correctly', function () {
		expect(superlogin.getConfig().baseUrl).toBe('/auth/');
		expect(superlogin.getConfig().providers[0]).toBe('friendface');
	});

	describe('login()', function () {

		it('should make a login request and set a session', function () {
			var doneFn = jasmine.createSpy("success");

			expect(superlogin.authenticated()).toBe(false);

			jasmine.Ajax.stubRequest('/auth/login').andReturn({
				"status": 200,
				"responseText": JSON.stringify({data: response}),
				"contentType": "application/json"
			});

			superlogin.login(testLogin).then(function () {
				doneFn(testLogin);
			});

			expect(jasmine.Ajax.requests.mostRecent().url).toBe('/auth/login');
			expect(doneFn).toHaveBeenCalledWith(testLogin);

			expect(superlogin.getSession().token).toBe('abc123');
			expect(superlogin.authenticated()).toBe(true);
		});

	});

	describe('interceptor', function () {

		beforeEach(function () {
			jasmine.Ajax.stubRequest('/auth/login').andReturn({
				"status": 201,
				"responseText": JSON.stringify({data: response}),
				"contentType": "application/json"
			});
			jasmine.Ajax.stubRequest('/unauthorized').andReturn({
				"status": 401,
				"responseText": JSON.stringify({data: response}),
				"contentType": "application/json"
			});
			superlogin.login(testLogin);
		});

		it('should add a bearer header to any request', function () {
			jasmine.Ajax.stubRequest('/test').andReturn({
				"status": 201,
				"responseText": JSON.stringify({data: response}),
				"contentType": "application/json"
			});

			$http.ajax({
				url: '/test',
				complete: function () {
					expect(checkBearerHeader(this.headers)).toBe(true);
				}
			});
		});

		function checkBearerHeader(header) {
			return header.Authorization === 'Bearer abc123:mypass';
		}

		it('should automatically logout if a request is unauthorized', function () {
			//var eventEmitted = false;
			expect(superlogin.authenticated()).toBe(true);
			$http.get('/unauthorized');
			expect(superlogin.authenticated()).toBe(false);
			//expect(eventEmitted).toBe(true);
		})

	});

	describe('socialAuth', function () {
		beforeEach(function () {
			$window.open = function () {
				expect(arguments[0]).toBe('/auth/friendface');
				return {closed: true};
			};
		});

		it('should login a user with a social auth popup', function (done) {
			superlogin.socialAuth('friendface')
				.then(function (result) {
					expect(result).toEqual(response);
					done();
				}, function () {
					throw new Error('socialAuth failed');
				});
			$window.superlogin.oauthSession(null, response);
		});

		it('should reject the promise if the user closes the window prior to authentication', function (done) {
			superlogin.socialAuth('friendface')
				.then(function () {
					throw new Error('socialAuth should not have succeeded');
				}, function () {
					done();
				});
			//$interval.flush(500);
		})
	});

	describe('refresh', function () {

		it('should refresh a token', function () {
			superlogin.setSession($.extend({}, response));
			var refreshResponse = {
				token: 'cdf456',
				expires: response.expires + 5000
			};

			jasmine.Ajax.stubRequest('/auth/refresh').andReturn({
				"status": 202,
				"responseText": JSON.stringify({data: refreshResponse}),
				"contentType": "application/json"
			});

			superlogin.refresh();
			expect(superlogin.getSession().token).toBe('cdf456');
		})

	});

	describe('checkRefresh', function () {

		beforeEach(function () {
			// Insert a Jasmine spy in superlogin.refresh
			var spy = jasmine.createSpy('refresh').and.callFake(function () {
				return $q({});
			});
			superlogin.refresh = spy;
			superlogin.onRefresh(spy);
		});

		it('should not refresh a token if the threshold has not been passed', function () {
			superlogin.setSession($.extend({}, response));
			_time = response.issued + 4000;
			superlogin.checkRefresh().then(function () {
				expect(superlogin.refresh).not.toHaveBeenCalled();
			});
		});

		it('should refresh a token if the threshold has been passed', function () {
			superlogin.setSession($.extend({}, response));
			_time = response.issued + 6000;
			superlogin.checkRefresh().then(function () {
				expect(superlogin.refresh).toHaveBeenCalled();
			});
		});

		it('should compensate for client time difference', function () {
			var session = $.extend({}, response);
			session.issued -= 10000;
			session.expires -= 10000;
			session.serverTimeDiff = -10000;
			superlogin.setSession(session);
			_time = response.issued + 4000;
			superlogin.checkRefresh().then(function () {
				expect(superlogin.refresh).not.toHaveBeenCalled();
			});
		});

	});
});
