import { createRequire } from "module";
const require = createRequire(import.meta.url);
const oracledb = require('oracledb');

// const dbConfig = {
//       user: "PSSJWIN",
//       password: "PSSJWIN_OCT2023",
//       connectString: "203.95.216.155:1555/AVT05p",

// };
const dbConfig = {
      user: "PSSDEMOGAR",
      password: "PSSDEMOGAR_MAY2023",
      connectString: "203.95.216.155:1555/AVT05p",
};
// const dbConfig = {
//       user: "TIPLAGF",
//       password: "TIPLAGF555",
//       connectString: "103.125.155.219:1555/an01p",

// };


export async function getConnection(res) {
      let connection;
      try {
            connection = await oracledb.getConnection({
                  user: dbConfig.user,
                  password: dbConfig.password,
                  connectString: dbConfig.connectString
            });
            return connection
      } catch (err) {
            return res.json({ statusCode: 1, message: "Database Connection Failed" })
      }
}
