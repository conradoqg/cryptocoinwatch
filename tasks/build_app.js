const gulp = require('gulp');
const watch = require('gulp-watch');
const batch = require('gulp-batch');
const jetpack = require('fs-jetpack');
const bundle = require('./bundle');
const utils = require('./utils');

const projectDir = jetpack;
const srcDir = jetpack.cwd('./src');
const destDir = jetpack.cwd('./app');

gulp.task('bundle', () => {
    return Promise.all([
        bundle(srcDir.path('background.js'), destDir.path('background.js'))
    ]);
});

gulp.task('environment', () => {
    const configFile = `config/env_${utils.getEnvName()}.json`;
    projectDir.copy(configFile, destDir.path('env.json'), { overwrite: true });
});

gulp.task('favicon', () => {
    const configFile = 'src/favicon.ico';
    projectDir.copy(configFile, destDir.path('favicon.ico'), { overwrite: true });
});

gulp.task('sampleConfig', () => {
    const configFile = 'src/sampleSettings.yaml.txt';
    projectDir.copy(configFile, destDir.path('sampleSettings.yaml.txt'), { overwrite: true });
});

gulp.task('watch', () => {
    const beepOnError = (done) => {
        return (err) => {
            if (err) {
                utils.beepSound();
            }
            done(err);
        };
    };

    watch('src/**/*.js', batch((events, done) => {
        gulp.start('bundle', beepOnError(done));
    }));
});

gulp.task('build', ['bundle', 'sampleConfig', 'favicon', 'environment']);
