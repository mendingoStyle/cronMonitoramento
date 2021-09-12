const cron = require('node-cron');
let lockFile = require('lockfile')
let Client = require('ftp');
let fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
let async = require('async');
let axios = require('axios');



async function comandoWindows(urlcomplete, url) {
  try {
    exec('exiftool -v4 imagens/' + url, async (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        return;
      }

      let mac_place = stdout.search("Mac=")
      let mac;
      if (mac_place != -1) {
        mac = stdout.substring(mac_place + 4, mac_place + 21)
      } else mac = "Default"


      await cadastrarCaptura(url, urlcomplete, mac)





    });
  } catch (e) {
    return e
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
    .then(async function (response) {
      console.log( response.data)
      return response.data
    })
    .catch(async function (error) {
      console.log(error)
      return error
    });

}
async function cadastrarCaptura(url, urlcomplete, mac) {
  let dataCaptura = urlcomplete.substring(12, 20)
  let ano = dataCaptura.substring(0, 4)
  let mes = dataCaptura.substring(4, 6)
  let dia = dataCaptura.substring(6, 9)
  let placa = urlcomplete.substring(32, 39)

  let dataFormatado = new Date(ano + '-' + mes + '-' + dia)

  let data = {
    mac: mac,
    url: url,
    placa: placa,
    dataHora: dataFormatado
  }


  var config = {
    method: 'post',
    url: 'http://localhost:9000/api/capturas/',
    headers: {
      accept: 'application/json',
    },
    data: data
  };


  return await axios(config)
    .then(async function (response) {
      return response

    })
    .catch(async function (error) {
      console.log(error)
      if (error.response.data.message = 'Validation error') {
        return await cadastrarCaptura(url, urlcomplete, mac)
      }
      return null
    });

}


async function mainThread() {
  let ops = {

  }
  lockFile.lock('some-file.lock', ops, async function (er) {
    console.log(er)
    console.log('começou')
    // if the er happens, then it failed to acquire a lock.
    // if there was not an error, then the file was created,
    // and won't be deleted until we unlock it.
    if(er) return null
    let c = new Client();

    let listFile = async function () {
      return new Promise(function (resolve, reject) {
        c.list(function (err, list) {
          if (err) reject(err)
          resolve(list)
        })
      })
    }
    //Get and unzipfiles from all folders

    listFile().then(async (paths) => {
      async.mapLimit(paths, 1, function (file, callback) {
        verificaURL(file.name).then(async response => {
          console.log(response)
          if (!response) {
            c.get(file.name, async function (err, stream) {
              if (err) {
                console.log('Error getting ' + file.name)
                callback(err)
              } else {
                return stream.pipe(fs.createWriteStream('imagens/' + file.name)).on('finish', async () => {
                  await comandoWindows('imagens/' + file.name, file.name)
                  callback();
                })
              }
            })
          } else {
            callback()
          }
        }).catch(e => {
          console.log(e)
        })
      }, function (err, res) {
        if (err) console.log(err)
        lockFile.unlock('some-file.lock', function (er) {
          // er means that an error happened, and is probably bad.
        })
        console.log('terminou terminado')
      })

    })

    var connectionProperties = {
      user: "teste",
      password: "teste",
    };
    c.connect(connectionProperties);
    // do my stuff, free of interruptions
    // then, some time later, do:
  })

}
cron.schedule('* * * * *', async () => {
  await mainThread()
});





