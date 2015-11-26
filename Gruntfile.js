'use strict';

module.exports = function(grunt) {
	var app = 'app/';
	var dist = 'dist/';

	// Load grunt tasks automatically
	require('load-grunt-tasks')(grunt);

	require('time-grunt')(grunt);

	// Project configuration.
	grunt.initConfig({
		watch: {
			css: {
				files: [
					app + 'assets/less/*.less',
					app + 'assets/less/site/*.less'
				],
				tasks: [
					'less:development'
				],
				options: {
					livereload: true,
				}
			},
			js: {
				files: [
					app + 'assets/js/*.js',
					'Gruntfile.js'
				],
				tasks: ['jshint'],
				options: {
					livereload: true,
				}
			}
		},
		browser_sync: {
			files: {
				src : [
					app + 'assets/css/*.css',
					app + 'assets/img/*',
					app + 'assets/js/*.js',
					app + '*.html'
				],
			},
			options: {
				watchTask: true,
				host: 'superlogin-client',
				port: 8888
			}
		},
		less: {
			development: {
				options: {
					sourceMap: true,
					sourceMapFilename: app + 'style.css.map',
					sourceMapURL: '/style.css.map',
					sourceMapBasepath: 'public',
					sourceMapRootpath: app,
					paths: app + 'assets/css'
				},
				files: {
					'app/assets/css/styles.css': 'app/assets/less/styles.less'
				}
			},
			dist: {
				options: {
					paths: app,
					sourceMap: false,
					cleancss: true,
					compress: true
				},
				files: {
					'dist/assets/css/styles.css': 'app/assets/less/styles.less'
				}
			}
		},
		clean: {
			dist: {
				files: [{
					dot: true,
					src: [
						'dist/*',
						'dist/.git*'
					]
				}]
			}
		},
		jshint: {
			options: {
				jshintrc: '.jshintrc'
			},
			all: ['Gruntfile.js', 'app/assets/js/*.js']
		},
		requirejs: {
			compile: {
				options: {
					baseUrl: app + 'assets/js',
					mainConfigFile: app + '/assets/js/main.js',
					optimize : 'uglify2',
					inlineText : true,
					findNestedDependencies : true,
					paths: {
						jquery: 'empty:',
						underscore: 'empty:',
						app: 'app'
					},
					dir: dist + '/assets/js',
					shim: {
						underscore: {
							deps: ['jquery'],
							exports: '_'
						},
						app: {
							deps: ['jquery', 'underscore']
						}
					}
				}
			}
		},
		imagemin: {
			dist: {
				files: [{
					expand: true,
					cwd: app + 'assets/images',
					src: '**/*.{png,jpg,jpeg}',
					dest: dist + 'assets/images'
				}],
				options: {
					cache: false
				}
			}
		},
		svgmin: {
			dist: {
				files: [{
					expand: true,
					cwd: app + 'assets/images',
					src: '**/*.svg',
					dest: dist + 'assets/images'
				}]
			}
		},
		preprocess: {
			dev: {
				options: {
					context: {
						NODE_ENV: 'DEVELOPMENT'
					},
				},
				files: {
					'app/index.html': 'app/index-template.html'
				},
			},
			dist: {
				options: {
					context: {
						NODE_ENV: 'PRODUCTION'
					},
				},
				files: {
					'dist/index.html': 'app/index-template.html'
				},
			},
		},
		copy: {
			dist: {
				files: [{
					expand: true,
					dot: true,
					cwd: app,
					dest: dist,
					src: [
						'*.{ico,txt,html}',
						'.htaccess',
						'assets/img/*.{gif,jpg,jpeg,png,svg}',
						'assets/fonts/*',
						'assets/bower_components/jquery/jquery.min.js',
						'assets/bower_components/modernizr/modernizr.js',
						'assets/bower_components/underscore/underscore-min.js',
						'assets/bower_components/requirejs/require.js'
					]
				}]
			}
		},
		hashres: {
			options: {
				encoding: 'utf8',
				fileNameFormat: '${name}.${ext}?${hash}',
				renameFiles: false
			},
			css: {
				src: [
					dist + 'styles.css'
				],
				dest: dist + '/index.html',
			}
		},
		buildcontrol: {
			options: {
				dir: 'dist',
				commit: true,
				push: true,
				message: 'Built %sourceName% from commit %sourceCommit% on branch %sourceBranch%'
			},
			prod: {
				options: {
					
					remote: 'https://github.com/dryajov/superlogin-client',
					
					branch: 'master'
				}
			}
		},
		concurrent: {
			dev: ['clean:dist', 'preprocess:dev'],
			build1: ['imagemin:dist', 'copy:dist', 'less:dist'],
			build2: ['preprocess:dist', 'svgmin:dist']
		}
	});

	grunt.registerTask('deploy', [
		'buildcontrol'
	]);

	grunt.registerTask('build', [
		'clean:dist',
		'concurrent:build1',
		'concurrent:build2',
		'hashres'
	]);

	grunt.registerTask('dev', [
		'concurrent:dev',
		'browser_sync',
		'watch'
	]);

	grunt.registerTask('default', 'dev');
};