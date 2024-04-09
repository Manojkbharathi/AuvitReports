const Oracle = require("Oracle")


export async function login(req, res) {
  const { success, connection } = await getConnection()
}        

app.post('/api/check-password', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
  
    // Fetch the hashed password from the database based on the provided username
    const oracledb = 'SELECT password FROM users SPUSERLOG username = :username';
    const binds = [username];
  
    connection.execute(oracledb, binds, (err, result) => {
      if (err) {
        console.error('Error checking password:', err);
        res.status(500).json({ error: 'Error checking password' });
      } else if (result.rows.length === 0) {
        res.json({ message: 'User not found' });
      } else {
        const storedHashedPassword = result.rows[0][0];
  
        // Compare the provided password with the stored hashed password
        bcrypt.compare(password, storedHashedPassword, (bcryptErr, match) => {
          if (bcryptErr) {
            console.error('Error comparing passwords:', bcryptErr);
            res.status(500).json({ error: 'Error checking password' });
          } else if (match) {
            res.json({ message: 'Password is correct' });
          } else {
            res.json({ message: 'Password is incorrect' });
          }
        });
      }
    });
  });