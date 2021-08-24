const cron = require('node-cron');

let lockFile = require('lockfile')
let Client = require('ftp');
var fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
var async = require('async');
var axios = require('axios');
var FormData = require('form-data');








async function comandoWindows(urlcomplete, url) {
  try {
    exec('exiftool -v4 imagens/' +  url, async (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        return;
      }

      let mac_place = stdout.search("Mac=")
      let mac;
      if (mac_place != -1) {
        mac = stdout.substring(mac_place + 4, mac_place + 21)
      } else mac = "Default"

      cadastrarCaptura(url, urlcomplete, mac)
        .then(r => {
          const id = r ? r.id : null
          console.log('capturaId: ' + id)

        })
        .catch(err => {
          console.log('erro ao cadastrar captura')
          console.log(err)
        })

    });
  } catch (e) {
    console.log(e)
  }


}
async function verificaURL(url) {

  let config = {
    method: 'get',
    url: `http://localhost:9000/api/capturas/${url}/imagem`,
    headers: {
      accept: 'application/json',
    },
    data: null
  };
  return await axios(config)
    .then(function (response) {
      console.log(response.data)
      return response.data
    })
    .catch(function (error) {
      console.log(error)
      return null
    });

}
async function cadastrarCaptura(url,urlcomplete, mac) {
  let dataCaptura = urlcomplete.substring(12, 20)
  let ano = dataCaptura.substring(0, 4)
  let mes = dataCaptura.substring(4, 6)
  let dia = dataCaptura.substring(6, 9)
  let placa = urlcomplete.substring(32, 39)

  let dataFormatado = new Date(ano + '-' + mes + '-' + dia)
  let data = new FormData();

  data.append('mac', mac)
  data.append('url', url)
  data.append('placa', placa);
  data.append('file', fs.createReadStream(urlcomplete));
  data.append('dataHora', dataFormatado.toUTCString())


  var config = {
    method: 'post',
    url: 'http://localhost:9000/api/capturas/',
    headers: {
      accept: 'application/json',
      ...data.getHeaders()
    },
    data: data
  };


  await axios(config)
    .then(function (response) {
      console.log(response)
      return response.data
      
    })
    .catch(function (error) {
      console.log(error)
      return null
    });

}


function mainThread() {
  
  let c = new Client(); 

  var listFile = function () {
    return new Promise(function (resolve, reject) {
      c.list(function (err, list) {
        if (err) reject(err)
        resolve(list)
      })
    })
  }
  //Get and unzipfiles from all folders

  listFile().then((paths) => {
    async.mapLimit(paths, 1, function (file, callback) {
      verificaURL(file.name).then(response => {
        if (response == null) {
          c.get(file.name, function (err, stream) {
            if (err) {
              console.log('Error getting ' + file.name)
              callback(err)
            } else {

              stream.pipe(fs.createWriteStream('imagens/' + file.name)).on('finish', async () => {
                await comandoWindows('imagens/' + file.name, file.name )
                callback();
              })
            }
          })
        } else {
          console.log('Já cadastrado')
          callback()
        }
      }).catch(e => {
        console.log(e)
      })
    }, function (err, res) {
      if (err) console.log(err)
      console.log(res)
    })

  })

  var connectionProperties = {
    user: "teste",
    password: "teste",
  };
  c.connect(connectionProperties);
}

mainThread()




