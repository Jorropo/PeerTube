'use strict'

const chai = require('chai')
const each = require('async/each')
const expect = chai.expect
const parallel = require('async/parallel')
const series = require('async/series')
const WebTorrent = require('webtorrent')
const webtorrent = new WebTorrent()

const loginUtils = require('../utils/login')
const miscsUtils = require('../utils/miscs')
const podsUtils = require('../utils/pods')
const serversUtils = require('../utils/servers')
const videosUtils = require('../utils/videos')

describe('Test multiple pods', function () {
  let servers = []
  const toRemove = []

  before(function (done) {
    this.timeout(30000)

    series([
      // Run servers
      function (next) {
        serversUtils.flushAndRunMultipleServers(3, function (serversRun) {
          servers = serversRun
          next()
        })
      },
      // Get the access tokens
      function (next) {
        each(servers, function (server, callbackEach) {
          loginUtils.loginAndGetAccessToken(server, function (err, accessToken) {
            if (err) return callbackEach(err)

            server.accessToken = accessToken
            callbackEach()
          })
        }, next)
      },
      // The second pod make friend with the third
      function (next) {
        const server = servers[1]
        podsUtils.makeFriends(server.url, server.accessToken, next)
      },
      // Wait for the request between pods
      function (next) {
        setTimeout(next, 10000)
      },
      // Pod 1 make friends too
      function (next) {
        const server = servers[0]
        podsUtils.makeFriends(server.url, server.accessToken, next)
      }
    ], done)
  })

  it('Should not have videos for all pods', function (done) {
    each(servers, function (server, callback) {
      videosUtils.getVideosList(server.url, function (err, res) {
        if (err) throw err

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(0)

        callback()
      })
    }, done)
  })

  describe('Should upload the video and propagate on each pod', function () {
    it('Should upload the video on pod 1 and propagate on each pod', function (done) {
      this.timeout(15000)

      series([
        function (next) {
          const name = 'my super name for pod 1'
          const description = 'my super description for pod 1'
          const tags = [ 'tag1p1', 'tag2p1' ]
          const file = 'video_short1.webm'
          videosUtils.uploadVideo(servers[0].url, servers[0].accessToken, name, description, tags, file, next)
        },
        function (next) {
          setTimeout(next, 11000)
        }],
        // All pods should have this video
        function (err) {
          if (err) throw err

          each(servers, function (server, callback) {
            let baseMagnet = null

            videosUtils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body.data
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(1)
              const video = videos[0]
              expect(video.name).to.equal('my super name for pod 1')
              expect(video.description).to.equal('my super description for pod 1')
              expect(video.podHost).to.equal('localhost:9001')
              expect(video.magnetUri).to.exist
              expect(video.duration).to.equal(10)
              expect(video.tags).to.deep.equal([ 'tag1p1', 'tag2p1' ])
              expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
              expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true
              expect(video.author).to.equal('root')

              if (server.url !== 'http://localhost:9001') {
                expect(video.isLocal).to.be.false
              } else {
                expect(video.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (baseMagnet === null) {
                baseMagnet = video.magnetUri
              } else {
                expect(video.magnetUri).to.equal.magnetUri
              }

              videosUtils.testVideoImage(server.url, 'video_short1.webm', video.thumbnailPath, function (err, test) {
                if (err) throw err
                expect(test).to.equal(true)

                callback()
              })
            })
          }, done)
        }
      )
    })

    it('Should upload the video on pod 2 and propagate on each pod', function (done) {
      this.timeout(15000)

      series([
        function (next) {
          const name = 'my super name for pod 2'
          const description = 'my super description for pod 2'
          const tags = [ 'tag1p2', 'tag2p2', 'tag3p2' ]
          const file = 'video_short2.webm'
          videosUtils.uploadVideo(servers[1].url, servers[1].accessToken, name, description, tags, file, next)
        },
        function (next) {
          setTimeout(next, 11000)
        }],
        // All pods should have this video
        function (err) {
          if (err) throw err

          each(servers, function (server, callback) {
            let baseMagnet = null

            videosUtils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body.data
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(2)
              const video = videos[1]
              expect(video.name).to.equal('my super name for pod 2')
              expect(video.description).to.equal('my super description for pod 2')
              expect(video.podHost).to.equal('localhost:9002')
              expect(video.magnetUri).to.exist
              expect(video.duration).to.equal(5)
              expect(video.tags).to.deep.equal([ 'tag1p2', 'tag2p2', 'tag3p2' ])
              expect(miscsUtils.dateIsValid(video.createdAt)).to.be.true
              expect(miscsUtils.dateIsValid(video.updatedAt)).to.be.true
              expect(video.author).to.equal('root')

              if (server.url !== 'http://localhost:9002') {
                expect(video.isLocal).to.be.false
              } else {
                expect(video.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (baseMagnet === null) {
                baseMagnet = video.magnetUri
              } else {
                expect(video.magnetUri).to.equal.magnetUri
              }

              videosUtils.testVideoImage(server.url, 'video_short2.webm', video.thumbnailPath, function (err, test) {
                if (err) throw err
                expect(test).to.equal(true)

                callback()
              })
            })
          }, done)
        }
      )
    })

    it('Should upload two videos on pod 3 and propagate on each pod', function (done) {
      this.timeout(30000)

      series([
        function (next) {
          const name = 'my super name for pod 3'
          const description = 'my super description for pod 3'
          const tags = [ 'tag1p3' ]
          const file = 'video_short3.webm'
          videosUtils.uploadVideo(servers[2].url, servers[2].accessToken, name, description, tags, file, next)
        },
        function (next) {
          const name = 'my super name for pod 3-2'
          const description = 'my super description for pod 3-2'
          const tags = [ 'tag2p3', 'tag3p3', 'tag4p3' ]
          const file = 'video_short.webm'
          videosUtils.uploadVideo(servers[2].url, servers[2].accessToken, name, description, tags, file, next)
        },
        function (next) {
          setTimeout(next, 22000)
        }],
        function (err) {
          if (err) throw err

          let baseMagnet = null
          // All pods should have this video
          each(servers, function (server, callback) {
            videosUtils.getVideosList(server.url, function (err, res) {
              if (err) throw err

              const videos = res.body.data
              expect(videos).to.be.an('array')
              expect(videos.length).to.equal(4)

              // We not sure about the order of the two last uploads
              let video1 = null
              let video2 = null
              if (videos[2].name === 'my super name for pod 3') {
                video1 = videos[2]
                video2 = videos[3]
              } else {
                video1 = videos[3]
                video2 = videos[2]
              }

              expect(video1.name).to.equal('my super name for pod 3')
              expect(video1.description).to.equal('my super description for pod 3')
              expect(video1.podHost).to.equal('localhost:9003')
              expect(video1.magnetUri).to.exist
              expect(video1.duration).to.equal(5)
              expect(video1.tags).to.deep.equal([ 'tag1p3' ])
              expect(video1.author).to.equal('root')
              expect(miscsUtils.dateIsValid(video1.createdAt)).to.be.true
              expect(miscsUtils.dateIsValid(video1.updatedAt)).to.be.true

              expect(video2.name).to.equal('my super name for pod 3-2')
              expect(video2.description).to.equal('my super description for pod 3-2')
              expect(video2.podHost).to.equal('localhost:9003')
              expect(video2.magnetUri).to.exist
              expect(video2.duration).to.equal(5)
              expect(video2.tags).to.deep.equal([ 'tag2p3', 'tag3p3', 'tag4p3' ])
              expect(video2.author).to.equal('root')
              expect(miscsUtils.dateIsValid(video2.createdAt)).to.be.true
              expect(miscsUtils.dateIsValid(video2.updatedAt)).to.be.true

              if (server.url !== 'http://localhost:9003') {
                expect(video1.isLocal).to.be.false
                expect(video2.isLocal).to.be.false
              } else {
                expect(video1.isLocal).to.be.true
                expect(video2.isLocal).to.be.true
              }

              // All pods should have the same magnet Uri
              if (baseMagnet === null) {
                baseMagnet = video2.magnetUri
              } else {
                expect(video2.magnetUri).to.equal.magnetUri
              }

              videosUtils.testVideoImage(server.url, 'video_short3.webm', video1.thumbnailPath, function (err, test) {
                if (err) throw err
                expect(test).to.equal(true)

                videosUtils.testVideoImage(server.url, 'video_short.webm', video2.thumbnailPath, function (err, test) {
                  if (err) throw err
                  expect(test).to.equal(true)

                  callback()
                })
              })
            })
          }, done)
        }
      )
    })
  })

  describe('Should seed the uploaded video', function () {
    it('Should add the file 1 by asking pod 3', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      videosUtils.getVideosList(servers[2].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[0]
        toRemove.push(res.body.data[2])
        toRemove.push(res.body.data[3])

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })

    it('Should add the file 2 by asking pod 1', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      videosUtils.getVideosList(servers[0].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[1]

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })

    it('Should add the file 3 by asking pod 2', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      videosUtils.getVideosList(servers[1].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[2]

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })

    it('Should add the file 3-2 by asking pod 1', function (done) {
      // Yes, this could be long
      this.timeout(200000)

      videosUtils.getVideosList(servers[0].url, function (err, res) {
        if (err) throw err

        const video = res.body.data[3]

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })
  })

  describe('Should update video views', function () {
    let localVideosPod3 = []
    let remoteVideosPod1 = []
    let remoteVideosPod2 = []
    let remoteVideosPod3 = []

    before(function (done) {
      parallel([
        function (callback) {
          videosUtils.getVideosList(servers[0].url, function (err, res) {
            if (err) throw err

            remoteVideosPod1 = res.body.data.filter(video => video.isLocal === false).map(video => video.id)

            callback()
          })
        },

        function (callback) {
          videosUtils.getVideosList(servers[1].url, function (err, res) {
            if (err) throw err

            remoteVideosPod2 = res.body.data.filter(video => video.isLocal === false).map(video => video.id)

            callback()
          })
        },

        function (callback) {
          videosUtils.getVideosList(servers[2].url, function (err, res) {
            if (err) throw err

            localVideosPod3 = res.body.data.filter(video => video.isLocal === true).map(video => video.id)
            remoteVideosPod3 = res.body.data.filter(video => video.isLocal === false).map(video => video.id)

            callback()
          })
        }
      ], done)
    })

    it('Should views multiple videos on owned servers', function (done) {
      this.timeout(30000)

      parallel([
        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[1], callback)
        },

        function (callback) {
          setTimeout(done, 22000)
        }
      ], function (err) {
        if (err) throw err

        each(servers, function (server, callback) {
          videosUtils.getVideosList(server.url, function (err, res) {
            if (err) throw err

            const videos = res.body.data
            expect(videos.find(video => video.views === 3)).to.be.exist
            expect(videos.find(video => video.views === 1)).to.be.exist

            callback()
          })
        }, done)
      })
    })

    it('Should views multiple videos on each servers', function (done) {
      this.timeout(30000)

      parallel([
        function (callback) {
          videosUtils.getVideo(servers[0].url, remoteVideosPod1[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[1].url, remoteVideosPod2[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[1].url, remoteVideosPod2[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, remoteVideosPod3[0], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, remoteVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, remoteVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, remoteVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[1], callback)
        },

        function (callback) {
          videosUtils.getVideo(servers[2].url, localVideosPod3[1], callback)
        },

        function (callback) {
          setTimeout(done, 22000)
        }
      ], function (err) {
        if (err) throw err

        let baseVideos = null
        each(servers, function (server, callback) {
          videosUtils.getVideosList(server.url, function (err, res) {
            if (err) throw err

            const videos = res.body

            // Initialize base videos for future comparisons
            if (baseVideos === null) {
              baseVideos = videos
              return callback()
            }

            for (let i = 0; i < baseVideos.length; i++) {
              expect(baseVideos[i].views).to.equal(videos[i].views)
            }

            callback()
          })
        }, done)
      })
    })
  })

  describe('Should manipulate these videos', function () {
    it('Should update the video 3 by asking pod 3', function (done) {
      this.timeout(15000)

      const name = 'my super video updated'
      const description = 'my super description updated'
      const tags = [ 'tagup1', 'tagup2' ]

      videosUtils.updateVideo(servers[2].url, servers[2].accessToken, toRemove[0].id, name, description, tags, function (err) {
        if (err) throw err

        setTimeout(done, 11000)
      })
    })

    it('Should have the video 3 updated on each pod', function (done) {
      this.timeout(200000)

      each(servers, function (server, callback) {
        // Avoid "duplicate torrent" errors
        const webtorrent = new WebTorrent()

        videosUtils.getVideosList(server.url, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          const videoUpdated = videos.find(function (video) {
            return video.name === 'my super video updated'
          })

          expect(!!videoUpdated).to.be.true
          expect(videoUpdated.description).to.equal('my super description updated')
          expect(videoUpdated.tags).to.deep.equal([ 'tagup1', 'tagup2' ])
          expect(miscsUtils.dateIsValid(videoUpdated.updatedAt, 20000)).to.be.true

          videosUtils.testVideoImage(server.url, 'video_short3.webm', videoUpdated.thumbnailPath, function (err, test) {
            if (err) throw err
            expect(test).to.equal(true)

            webtorrent.add(videoUpdated.magnetUri, function (torrent) {
              expect(torrent.files).to.exist
              expect(torrent.files.length).to.equal(1)
              expect(torrent.files[0].path).to.exist.and.to.not.equal('')

              callback()
            })
          })
        })
      }, done)
    })

    it('Should remove the videos 3 and 3-2 by asking pod 3', function (done) {
      this.timeout(15000)

      series([
        function (next) {
          videosUtils.removeVideo(servers[2].url, servers[2].accessToken, toRemove[0].id, next)
        },
        function (next) {
          videosUtils.removeVideo(servers[2].url, servers[2].accessToken, toRemove[1].id, next)
        }],
        function (err) {
          if (err) throw err
          setTimeout(done, 11000)
        }
      )
    })

    it('Should have videos 1 and 3 on each pod', function (done) {
      each(servers, function (server, callback) {
        videosUtils.getVideosList(server.url, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          expect(videos).to.be.an('array')
          expect(videos.length).to.equal(2)
          expect(videos[0].name).not.to.equal(videos[1].name)
          expect(videos[0].name).not.to.equal(toRemove[0].name)
          expect(videos[1].name).not.to.equal(toRemove[0].name)
          expect(videos[0].name).not.to.equal(toRemove[1].name)
          expect(videos[1].name).not.to.equal(toRemove[1].name)

          callback()
        })
      }, done)
    })
  })

  after(function (done) {
    servers.forEach(function (server) {
      process.kill(-server.app.pid)
    })

    // Keep the logs if the test failed
    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
