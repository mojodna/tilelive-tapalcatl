const constants = require("constants");
const url = require("url");

const semver = require("semver");
const StreamZip = require("node-stream-zip");

const remoteFs = require("./lib/remote_fs");

process.on("unhandledRejection", err => {
  throw err;
});

StreamZip.setFs(remoteFs);

module.exports = (tilelive, options) => {
  var Tapalcatl = function(uri, callback) {
    // TODO clean this up and clone uri
    uri.protocol = uri.protocol.replace(/tapalcatl\+/, "");

    if (semver.satisfies(process.version, ">=0.11.0")) {
      // Node 0.12 changes the behavior of url.parse such that components are
      // url-encoded
      uri.hash = uri.hash && decodeURIComponent(uri.hash);
      uri.pathname = decodeURIComponent(uri.pathname);
      uri.path = decodeURIComponent(uri.path);
      uri.href = decodeURIComponent(uri.href);
    }

    this.uri = url.format(uri);

    return setImmediate(callback, null, this);
  };

  Tapalcatl.prototype.getTile = function(z, x, y, callback) {
    const uri = url.format(this.uri)
    const zoomOffset = 5;

    // TODO cache this and close when evicted
    const zip = new StreamZip({
      chunkSize: 1024 * 1024,
      file: this.uri
        .replace(/{z}/, z - zoomOffset)
        .replace(/{x}/, Math.floor(x / Math.pow(2, zoomOffset)))
        .replace(/{y}/, Math.floor(y / Math.pow(2, zoomOffset)))
    });

    zip.on("error", err => {
      if (err.errno === -constants.ENOENT) {
        return callback();
      }

      return callback(new Error(err))
    });

    const filename = `${z}/${x}/${y}.mvt`;

    zip.on("ready", () => {
      // check if the tile exists
      if (zip.entries()[filename] == null) {
        return callback(null, null);
      }

      zip.stream(filename, (err, tile) => {
        if (err) {
          return callback(err);
        }

        const chunks = [];

        tile.on("data", chunk => chunks.push(chunk));

        tile.on("end", () => callback(null, Buffer.concat(chunks), {
          // TODO headers from sidecar metadata + info
          "Content-Type": "application/vnd.mapbox-vector-tile"
        }));
      });
    });
  };

  Tapalcatl.prototype.getInfo = function(callback) {
    // TODO extract this from the source URI
    return setImmediate(callback, null, {
      minzoom: 14,
      maxzoom: 14,
      tilejson: "2.2.0",
      format: "pbf"
    });
  };

  Tapalcatl.prototype.close = function(callback) {
    return callback && setImmediate(callback);
  };

  Tapalcatl.registerProtocols = function(tilelive) {
    tilelive.protocols["tapalcatl+http:"] = Tapalcatl;
    tilelive.protocols["tapalcatl+https:"] = Tapalcatl;
    // TODO tapalcatl+s3 for requester-pays support
  };

  Tapalcatl.registerProtocols(tilelive);

  return Tapalcatl;
};
