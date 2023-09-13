import minimist from 'minimist';

/**
 * A simple logging function.
 * @param {...any} args arguments.
 */
export function log(...args) {
    const padLeft = (value = 0, length = 2) => `${value}`.padStart(length, '0');
    const now = new Date();
    const year = padLeft(now.getFullYear(), 4);
    const month = padLeft(now.getMonth() + 1);
    const day = padLeft(now.getDate());
    const hour = padLeft(now.getHours());
    const minute = padLeft(now.getMinutes());
    const second = padLeft(now.getSeconds());
    const ms = padLeft(now.getMilliseconds(), 3);
    const time = `${year}/${month}/${day} ${hour}:${minute}:${second}.${ms}`;
    console.log(`${time} ${args.join(' ')}`);
}

/**
 * @returns all arguments passed into the application.
 */
export function args() {
    return minimist(process.argv.slice(2));
}