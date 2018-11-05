const url = require("url");

const clone = require("clone");
const tapalcatl = require("tapalcatl");
const toArray = require("stream-to-array");

process.on("unhandledRejection", err => {
  throw err;
});

module.exports = (tilelive, options) => {
  var Tapalcatl = function(uri, callback) {
    const source = clone(uri);

    source.protocol = source.protocol.replace(/\w+\+/, "");

    source.hash = source.hash && decodeURIComponent(source.hash);
    source.pathname = decodeURIComponent(source.pathname);
    source.path = decodeURIComponent(source.path);
    source.href = decodeURIComponent(source.href);

    // TODO pull format, scale, variant from source.query

    this.source = tapalcatl(url.format(source));

    return callback(null, this);
  };

  Tapalcatl.prototype.getTile = async function(z, x, y, callback) {
    const { body, headers } = await this.source.getTile(z, x, y);

    // convert headers from a list to an object
    const h = headers.reduce((acc, h) => {
      const k = Object.keys(h).pop();
      acc[k] = h[k];

      return acc;
    }, {});

    if (body != null) {
      return callback(null, Buffer.concat(await toArray(body)), h);
    }

    return callback();
  };

  Tapalcatl.prototype.getInfo = async function(callback) {
    const meta = await this.source.meta();
    const formats = Object.keys(meta.formats);
    const format = formats.pop();

    return callback(null, {
      ...meta,
      format
    });
  };

  Tapalcatl.prototype.close = function(callback) {
    return callback && setImmediate(callback);
  };

  Tapalcatl.registerProtocols = function(tilelive) {
    tilelive.protocols["tapalcatl+file:"] = Tapalcatl;
    tilelive.protocols["tapalcatl+http:"] = Tapalcatl;
    tilelive.protocols["tapalcatl+https:"] = Tapalcatl;
    tilelive.protocols["tapalcatl+s3:"] = Tapalcatl;
  };

  Tapalcatl.registerProtocols(tilelive);

  return Tapalcatl;
};
