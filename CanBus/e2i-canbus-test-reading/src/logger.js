const winston = require('winston');
const { format, level, prettyPrint } = require('winston');

const timezoned = () => {
  const date = new Date();
  const year = date.toLocaleString('es-ES', { timeZone: 'America/Lima', year: 'numeric' });
  const month = date.toLocaleString('es-ES', { timeZone: 'America/Lima', month: 'long' });
  return [year, month]
}

require('winston-daily-rotate-file');

var transport = new (winston.transports.DailyRotateFile)({
  level: 'info',
  filename: __dirname + `/../logs/${timezoned()[0]}/${timezoned()[1]}/%DATE%.log`,
  handleExceptions: true,
  json: false,
  datePattern: 'YYYYMMDD',
  zippedArchive: true,
  maxSize: '1g',
  colorize: true,
  maxFiles: '30d'
});

transport.on('rotate', function (oldFilename, newFilename) {
  // do something fun
});

var logger = winston.createLogger({
  format: format.combine(
    format.simple(),
    format.timestamp({ format: 'YYYY/MM/DD HH:mm:ss.SSSSSSS' }),
    format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [
    transport
  ],
  exitOnError: false
});

module.exports.logger = logger;