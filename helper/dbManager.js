
const { getSQLConnection } = require('./dbConnect');

let dbManager = {};


const DATABSE_QUERY = {
  "getTableSchema": {
    "mysql": "SELECT column_name as column_name, data_type as data_type FROM information_schema.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ? ;",
    "postgres": "SELECT column_name, data_type FROM information_schema.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = 'public' AND TABLE_CATALOG = ? ;"
  },
}

/**
 * Database Insert
 * @function insert
 * @param {string} tableName
 * @param {Object} query
 * @returns {Promise<Number>} Number of rows inserted
 */
dbManager.insert = async (tableName, query) => {
  const conn = await getSQLConnection();
  let sql = `INSERT into ${{ "postgres": '"public".', "mysql": '' }[process.env.DATABASE_TYPE]}"${tableName}" (`;
  let keys = Object.keys(query);
  let replacements = [];

  // Add keys from json to SQL query
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i]
    sql += `"${key}" ${i != keys.length - 1 ? ', ' : ''} `;
  }

  sql += ") VALUES (";

  // Add values from json to SQL query
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let value = query[key];

    if (typeof value == 'object') {
      value = JSON.stringify(value);
    }
    sql += ` ? ${i != keys.length - 1 ? ', ' : ''} `;
    replacements.push(value);
  }

  sql += `)`;

  // Remove double qoutes from mysql query and replace single qoutes to double
  if (process.env.DATABASE_TYPE == "postgres") {
    sql += ' RETURNING * ';
    sql = sql.replace(/'/g, '"');
  } else if (process.env.DATABASE_TYPE == "mysql") {
    // sql += `; SELECT LAST_INSERT_ID();`
    sql = sql.replace(/"/g, '');
  }

  let res = await conn.query(sql, {
    replacements: replacements, raw: false
  });

  return { "postgres": res[0][0], "mysql": res[0] }[process.env.DATABASE_TYPE];
};

/**
 * Database find
 * @function find
 * @param {string} tableName
 * @param {Object} query
 * @param {Object} order
 * @returns {Promise<Object>}
 */
dbManager.find = async (tableName, query, order = {}) => {
  const conn = await getSQLConnection();
  let sql = `SELECT * FROM ${{ "postgres": '"public".', "mysql": '' }[process.env.DATABASE_TYPE]}"${tableName}" WHERE `;
  let keys = Object.keys(query);
  let replacements = [];

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let value = query[key];
    let eq = '=';

    if (typeof value == 'object') {
      const fieldVal = Object.keys(value)[0];
      switch (fieldVal) {
        case '$lt':
          eq = '<';
          value = value[fieldVal];
          break;

        case '$lte':
          eq = '<=';
          value = value[fieldVal];
          break;

        case '$gt':
          eq = '>';
          value = value[fieldVal];
          break;

        case '$gte':
          eq = '>=';
          value = value[fieldVal];
          break;

        case '$in':
          eq = 'IN';
          value = `(${value[fieldVal].join(',')})`;
          break;
      }

      if (typeof value == 'object')
        value = JSON.stringify(value);
    }

    sql += ` "${key}" ${eq} ? ${i != keys.length - 1 ? ' AND ' : ''}`;
    replacements.push(value);
  }

  keys = Object.keys(order);
  for (let i = 0; i < keys.length; i++) {
    if (i == 0) sql += " ORDER BY ";
    let key = keys[i];
    let value = order[key];

    sql += ` "${key}" ${value == 1 ? ' ASC ' : ' DESC '} ${i != keys.length - 1 ? ', ' : ''}`;
  }

  // Remove double qoutes from mysql query and replace single qoutes to double
  if (process.env.DATABASE_TYPE == "postgres")
    sql = sql.replace(/'/g, '"');
  else if (process.env.DATABASE_TYPE == "mysql")
    sql = sql.replace(/"/g, '');

  const res = await conn.query(sql, {
    replacements: replacements, raw: true, nest: true
  });
  return res;
};

/**
 * Database find one record
 * @function findOne
 * @param {string} tableName
 * @param {Object} query
 * @param {Object} order
 * @returns {Promise<Object>}
 */
dbManager.findOne = async (tableName, query, order = {}) => {
  const conn = await getSQLConnection();
  let sql = `SELECT * FROM ${{ "postgres": '"public".', "mysql": '' }[process.env.DATABASE_TYPE]}"${tableName}" WHERE `;
  let keys = Object.keys(query);
  let replacements = [];

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let value = query[key];
    let eq = '=';

    if (typeof value == 'object') {
      const fieldVal = Object.keys(value)[0];
      switch (fieldVal) {
        case '$lt':
          eq = '<';
          value = value[fieldVal];
          break;

        case '$lte':
          eq = '<=';
          value = value[fieldVal];
          break;

        case '$gt':
          eq = '>';
          value = value[fieldVal];
          break;

        case '$gte':
          eq = '>=';
          value = value[fieldVal];
          break;

        case '$in':
          eq = 'IN';
          value = `(${value[fieldVal].join(',')})`;
          break;
      }

      if (typeof value == 'object')
        value = JSON.stringify(value);
    }

    sql += ` "${key}" ${eq} ? ${i != keys.length - 1 ? ' AND ' : ''}`;
    replacements.push(value);
  }

  keys = Object.keys(order);
  for (let i = 0; i < keys.length; i++) {
    if (i == 0) sql += " ORDER BY ";
    let key = keys[i];
    let value = order[key];

    sql += ` "${key}" ${value == 1 ? ' ASC ' : ' DESC '} ${i != keys.length - 1 ? ', ' : ''}`;
  }

  sql += ` LIMIT 1`;
  // Remove double qoutes from mysql query and replace single qoutes to double
  if (process.env.DATABASE_TYPE == "postgres")
    sql = sql.replace(/'/g, '"');
  else if (process.env.DATABASE_TYPE == "mysql")
    sql = sql.replace(/"/g, '');

  const res = await conn.query(sql, {
    replacements: replacements, raw: true, nest: true
  });
  return res;
};

/**
 * Database Update
 * @function update
 * @param {string} tableName
 * @param {Object} query
 * @param {Object} updates
 * @returns {Promise<Number>} Number of rows affected
 */
dbManager.update = async (tableName, query, updates) => {
  const conn = await getSQLConnection();
  let sql = `UPDATE ${{ "postgres": '"public".', "mysql": '' }[process.env.DATABASE_TYPE]}"${tableName}" SET `;
  let keys = Object.keys(updates);
  let replacements = [];

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let value = updates[key];
    let eq = '=';

    if (typeof value == 'object') {
      const fieldVal = Object.keys(value)[0];
      switch (fieldVal) {
        case '$inc':
          eq = ` = "${key}" + `;
          value = value[fieldVal];
          break;

        case '$dec':
          eq = ` = "${key}" + `;
          value = value[fieldVal];
          break;
      }

      if (typeof value == 'object')
        value = JSON.stringify(value);
    }

    sql += ` "${key}" ${eq} ? ${i != keys.length - 1 ? ', ' : ''}`;
    replacements.push(value);
  }

  keys = Object.keys(query);
  for (let i = 0; i < keys.length; i++) {
    if (i == 0) sql += " WHERE ";

    let key = keys[i];
    let value = query[key];
    let eq = '=';

    if (typeof value == 'object') {
      const fieldVal = Object.keys(value)[0];
      switch (fieldVal) {
        case '$lt':
          eq = '<';
          value = value[fieldVal];
          break;

        case '$lte':
          eq = '<=';
          value = value[fieldVal];
          break;

        case '$gt':
          eq = '>';
          value = value[fieldVal];
          break;

        case '$gte':
          eq = '>=';
          value = value[fieldVal];
          break;
      }

      if (typeof value == 'object')
        value = JSON.stringify(value);
    }

    sql += ` "${key}" ${eq} ? ${i != keys.length - 1 ? ' AND ' : ''}`;
    replacements.push(value);
  }

  // Remove double qoutes from mysql query and replace single qoutes to double
  if (process.env.DATABASE_TYPE == "postgres") {
    // sql += ' RETURNING * ';
    sql = sql.replace(/'/g, '"');
  } else if (process.env.DATABASE_TYPE == "mysql")
    sql = sql.replace(/"/g, '');

  let res = await conn.query(sql, {
    replacements: replacements, raw: true
  });

  // console.log(res);
  return { "postgres": res[1].rowCount, "mysql": res[1].affectedRows }[process.env.DATABASE_TYPE];
};

dbManager.doExecute = async (sqlObj, replacements) => {
  const conn = await getSQLConnection();
  const res = await conn.query(sqlObj[process.env.DATABASE_TYPE], {
    replacements: replacements, raw: true, nest: true
  });
  return res;
};

dbManager.doExecuteRawQuery = async (sqlQuery, replacements) => {
  const conn = await getSQLConnection();
  const res = await conn.query(sqlQuery, {
    replacements: replacements, raw: true, nest: true
  });
  return res;
};

dbManager.verifyTbl = async (tableName, model) => {
  const schema = await dbManager.doExecute(DATABSE_QUERY['getTableSchema'], [tableName, process.env.SQL_DB_NAME]);

  const dbSchema = {};
  let dbResult = [];
  schema.map(fields => dbSchema[fields.column_name] = fields.data_type);

  const DATA_TYPE = require("../lib/dataType");
  if (model[process.env.DATABASE_TYPE]) {
    Object.keys(model[process.env.DATABASE_TYPE]).map(field => {
      let type = model[process.env.DATABASE_TYPE][field];
      if (type.indexOf("$") == 0) {
        type = DATA_TYPE[type.split('$').join('')] ? DATA_TYPE[type.split('$').join('')][process.env.DATABASE_TYPE] : type;
      }
      if (type != dbSchema[field]) {
        let result = `Database Schema Error of ${tableName} table : Invalid database field ${field}. ${dbSchema[field] ? `Expected type: ${type}, Current type: ${dbSchema[field]}` : `Missing field ${field} of type ${type}`}`;
        dbResult.push(result);
      }
    });
  } else {
    Object.keys(model['default']).map(field => {
      let type = model['default'][field];
      if (type.indexOf("$") == 0) {
        type = DATA_TYPE[type.split('$').join('')] ? DATA_TYPE[type.split('$').join('')][process.env.DATABASE_TYPE] : type;
      }
      if (type != dbSchema[field]) {
        let result = `Database Schema Error of ${tableName} table : Invalid database field ${field}. ${dbSchema[field] ? `Expected type: ${type}, Current type: ${dbSchema[field]}` : `Missing field ${field} of type ${type}`}`;
        dbResult.push(result);
      }
    });
  }

  return dbResult;
};

/**
 * 
 * AUTH_MODE = JWT/JWT_DB/JWT_DB_REFRESH
 * 
 * */
dbManager.verifyAccessToken = async (accessToken) => {
  const jwt = require("./jwt");
  const { AUTH_MODE, JWT_SECRET, JWT_ID_KEY, DB_ID_KEY, DB_TABLE_NAME, DB_ACCESS_KEY } = JSON.parse(process.env.AUTH);
  const decodedVal = await jwt.decodeJwtToken(accessToken, JWT_SECRET);
  if (!decodedVal || !decodedVal[JWT_ID_KEY]) {
    return false;
  }

  if (AUTH_MODE == "JWT_DB") {
    const verifedUser = await dbManager.find(DB_TABLE_NAME, { [DB_ACCESS_KEY]: accessToken, [DB_ID_KEY]: decodedVal[JWT_ID_KEY] });
    if (verifedUser.length > 0) {
      return verifedUser[0];
    };
  } else {
    return { [DB_ID_KEY]: decodedVal[JWT_ID_KEY] };
  }

  return false;
};

module.exports = { dbManager: dbManager };