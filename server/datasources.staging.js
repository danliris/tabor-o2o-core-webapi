module.exports = {
  db: {
    "host": process.env.DB_HOST,
    "port": process.env.DB_PORT,
    "database": process.env.DB_NAME,
    "password": process.env.DB_PASSWORD,
    "user": process.env.DB_USER,
    options: {
        encrypt: true
    },
    connectionTimeout: 300 * 60 * 1000,
    requestTimeout: 60 * 60 * 1000
  }
};
