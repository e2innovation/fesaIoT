var winston = require('winston');
const { format, level, prettyPrint } = require('winston');

const timezoned = () => {
  const date = new Date();
  const year = date.toLocaleString('es-ES', { timeZone: 'America/Lima', year: 'numeric' });
  const month = date.toLocaleString('es-ES', { timeZone: 'America/Lima', month: 'long' });
  return [year, month]
}

require('winston-daily-rotate-file');

var transport = new winston.transports.DailyRotateFile({
  level: 'info',
  filename: __dirname + `/../candumps/${timezoned()[0]}/${timezoned()[1]}/%DATE%.log`,
  datePattern: 'YYYYMMDD',
  handleExceptions: true,
  json: false,
  zippedArchive: true,
  maxSize: '1g',
  maxFiles: '3d',
  colorize: false
});

transport.on('rotate', function(oldFilename, newFilename) {
  // do something fun
});

var candump = winston.createLogger({
    format: format.combine(
        format.simple(),
        format.timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
        format.printf(info => `${info.message}`)
    ),
    transports: [
        transport
    ],
    exitOnError: false
});

module.exports.candump = candump