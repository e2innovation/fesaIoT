const zlib = require('zlib'); 
const crypto = require('crypto');

let IV = "047a279e89c07594";

function decrypt(value){
    let dataIn =  value.toString('base64');
    let KEY = "a00b5adf64c69811a277838000f5dfab"; 

    let decryptOperation = ((decryptedIn) => {
      let decipher = crypto.createDecipheriv('aes-256-cbc', KEY, IV);
      let decrypted = decipher.update(decryptedIn, 'base64', 'base64');
      return (decrypted + decipher.final('base64'));
    });
    
    let dataDecryption = decryptOperation(dataIn);
    let buffer_2 = zlib.unzipSync(Buffer.from(dataDecryption, 'base64'));
    let dataDecompression = (buffer_2);
    
    return dataDecompression ;
  }

  module.exports.decrypt = decrypt;