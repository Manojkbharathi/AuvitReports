import bcrypt from 'bcrypt'
const saltRounds = 10
const password = "Admin@123"


const hashedPassword = bcrypt.hashSync(password,saltRounds)
console.log(hashedPassword)