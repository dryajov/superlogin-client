var gulp = require('gulp');
var karma = require('karma').server;
var jshint = require('gulp-jshint');
var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var gulpCopy = require('gulp-copy');
var del = require('del');
var browserify = require('browserify');
var partialify = require('partialify');
var source = require('vinyl-source-stream');
var browserifyshim = require('browserify-shim');

gulp.task('default', ['test']);

gulp.task('lint', function () {
	return gulp.src('./src/*.js')
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('test', ['browserify-test', 'lint'], function (done) {
	karma.start({
		configFile: __dirname + '/karma.conf.js',
		singleRun: true
	}, done);
});

gulp.task('clean:dist', function () {
	return del([
		'dist/**/*',
		'!dist/.git/**/*'
	]);
});

gulp.task('copy', function () {
	return gulp.src(['./README.md', './LICENSE', './config.example.js', './package.json'])
		.pipe(gulpCopy('./dist/'));
});

// Browserify
gulp.task('browserify', function () {
	return browserify({
		//standalone: true,
		global: true
	}).add(__dirname + '/scripts/app/superlogin.js')
		.external('jquery')
		.transform(browserifyshim) // Transform to allow requireing of templates
		.transform(partialify) // Transform to allow requireing of templates
		.bundle()
		.pipe(source('main.js'))
		.pipe(gulp.dest('./dist/scripts/'));
});


// Browserify
gulp.task('browserify-test', function () {
	return browserify({debug: true})
		.require('jquery')
		.add(__dirname + '/scripts/test/specs.js')
		.transform(partialify) // Transform to allow requireing of templates
		.bundle()
		.pipe(source('specs.js'))
		.pipe(gulp.dest('./dist/test/'));
});

gulp.task('build', ['test', 'copy', 'browserify'], function () {
	gulp.src('./src/*.js')
		.pipe(gulp.dest('./dist/'))
		.pipe(sourcemaps.init())
		.pipe(uglify({output: {comments: /^!|@preserve|@license|@cc_on/i}, outSourceMap: true}))
		.pipe(rename({extname: '.min.js'}))
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/'));
});
