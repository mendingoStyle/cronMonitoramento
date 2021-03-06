const cron = require('node-cron');
let lockFile = require('lockfile')
let Client = require('ftp');
let fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
let async = require('async');
let axios = require('axios');
require('dotenv/config');



async function comandoWindows(urlcomplete, url) {
  try {
    exec('exiftool -v4 imagens/' + url, async (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        return;
      }

      let mac_place = stdout.search("Mac=")
      let mac;
      let modelo_place = stdout.search("Modelo=")

      let make = ""
      let make_place = stdout.search("Make = ")
      let creation_time_place = stdout.search("CreateDate = 20")
      let creation_time = ""

      if (creation_time_place != -1) {
        creation_time = stdout.substring(creation_time_place + 24, creation_time_place + 32)
      }


      if (make_place != -1) {
        make = stdout.substring(make_place + 7, make_place + 17)
      }

      if (modelo_place != -1) {
        modelo = stdout.substring(modelo_place + 7, modelo_place + 17)

      } else modelo = ""
      modelo = make + " " + modelo

      if (mac_place != -1) {
        mac = stdout.substring(mac_place + 4, mac_place + 21)
      } else mac = "Default"


      await cadastrarCaptura(url, urlcomplete, mac, modelo, creation_time)


    });
  } catch (e) {
    return e
  }


}
async function verificaURL(url) {

  let config = {
    method: 'get',
    url: `http://localhost:9000/cron/capturas/${url}/imagem`,
    headers: {
      accept: 'application/json',
    },
    data: null
  };
  return await axios(config)
    .then(async function (response) {

      return response.data
    })
    .catch(async function (error) {

      return error
    });

}
async function cadastrarCaptura(url, urlcomplete, mac, modelo, creation) {
  let dataCaptura = urlcomplete.substring(12, 20)
  let ano = dataCaptura.substring(0, 4)
  let mes = dataCaptura.substring(4, 6)
  let dia = dataCaptura.substring(6, 9)
  let placa = urlcomplete.substring(32, 39)

  let dataFormatado = new Date(ano + '-' + mes + '-' + dia)

  let data = {
    detalhes: creation,
    modelo: modelo,
    mac: mac,
    url: url,
    placa: placa,
    dataHora: dataFormatado
  }


  var config = {
    method: 'post',
    url: 'http://localhost:9000/cron/capturas/',
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

      if (!error && !error.response && !error.response.data && error.response.data.message === 'Validation error') {
        return await cadastrarCaptura(url, urlcomplete, mac)
      }
      return null
    });

}

async function goThroughPaths(paths, c) {
  async.mapLimit(paths, 1, function (file, callback) {
    verificaURL(file.name).then(response => {
      if (!response) {
        callback()
      } else {
        if (!(file.name.indexOf('.jpg') !== -1)) {
        } else {
          if (fs.existsSync('imagens/' + file.name)) {
            c.put('imagens/' + file.name, file.name, false, function (error) {
              if (!error) {
                c.cdup(function (err) {
                  if (!err) {
                    c.delete(file.name, function (deleteError) {
                      if (!deleteError) {
                        c.cwd(process.env.path_ftp + '/' + process.env.path_ftp_subdiretorio_lidas, function (errcwd) {
                          if (!errcwd) callback()
                        })
                      }
                    })
                  }
                })
              } else {
                callback(error)
              }
            })

          } else {
            callback()
          }

        }



      }
    })
  }, function (err, res) {


    lockFile.unlock(process.env.LOCK_FILE_NAME + '.lock', function (er) {
      console.log('terminou')
      paths.forEach(element => {

        if ((element.name.indexOf('.jpg') !== -1)) {
          var config = {
            method: 'get',
            url: `http://localhost:9000/cron/capturas/${element.name}/imagem/captura`,
            headers: {
              accept: 'application/json',
            },
          };
          axios(config)
            .then(function (response) {

            })
            .catch(function (error) {

            });
        }


      });
      c.end()
    })
  })

}

async function putOnAlreadyRead(paths, c) {
  c.cwd(process.env.path_ftp + '/' + process.env.path_ftp_subdiretorio_lidas, function (errcwd) {
    if (errcwd && errcwd.code == 550) {
      c.mkdir(process.env.path_ftp + '/' + process.env.path_ftp_subdiretorio_lidas, false, function (errmdkir) {
        if (errmdkir) {

        } else {
          c.cwd(process.env.path_ftp + '/' + process.env.path_ftp_subdiretorio_lidas, function (errcwd2) {
            if (!errcwd2) {
              goThroughPaths(paths, c)
            }
          })
        }
      })
    } else {
      if (!errcwd) {
        goThroughPaths(paths, c)
      }
    }
  })
}
async function mainThread() {
  let ops = {

  }
  lockFile.lock(process.env.LOCK_FILE_NAME + '.lock', ops, async function (er) {
    if (!er) {
      console.log('come??ou')
      if (er) return null
      let c = new Client();

      let listFile = async function () {
        return new Promise(function (resolve, reject) {
          c.list(process.env.path_ftp, function (err, list) {
            if (err) reject(err)
            resolve(list)
          })
        })
      }
      //Get and unzipfiles from all folders

      listFile().then(async (paths) => {
        async.mapLimit(paths, 1, function (file, callback) {
          if (!(file.name.indexOf('.jpg') !== -1)) {
            callback();
          } else {
            verificaURL(file.name).then(response => {
              if (!response) {
                c.get(process.env.path_ftp + "/" + file.name, function (err, stream) {
                  if (err) {
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

            })
          }
        }, function (err, res) {
          putOnAlreadyRead(paths, c)
        })

      })

      var connectionProperties = {
        host: process.env.ftp_host,
        port: process.env.ftp_port,
        user: process.env.ftp_login,
        password: process.env.ftp_senha,
      };
      c.connect(connectionProperties);
    }
  })

}
cron.schedule('* * * * *', async () => {
  await mainThread()
});





