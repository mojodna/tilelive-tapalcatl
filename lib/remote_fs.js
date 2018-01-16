const constants = require("constants");
const fs = require("fs");

const fetch = require("node-fetch");

// TODO implement a block-level cache + align range requests to that block size
// TODO better on-disk (w/ level), but requires expiration
module.exports = {
  open: (uri, mode, callback) => {
    return fetch(uri, {
      method: "HEAD"
    }).then(res => {
      if (res.status != 200) {
        const err = new Error(`ENOENT: no such file or directory, open '${uri}'`);
        err.errno = -constants.ENOENT;
        err.code = "ENOENT";
        err.syscall = "open";
        err.path = uri;
        return callback(err);
      }

      return callback(null, {
        bytesRead: 0,
        position: 0,
        size: res.headers.get("content-length"),
        uri
      });
    });
  },

  fstat: (fd, callback) =>
    callback(
      null,
      new fs.Stats(
        0, // dev
        0o100600, // mode
        1, // nlink
        100, // uid
        100, // gid
        0, // rdev
        0, // blksize
        0, // ino
        fd.size, // size
        0, // blocks,
        0, // atim_msec
        0, // mtim_msec
        0, // ctim_msec
        0 // birthtim_msec
      )
    ),

  read: (fd, buffer, offset, length, position, callback) => {
    // position is an argument specifying where to begin reading from in the
    // file. If position is null, data will be read from the current file
    // position, and the file position will be updated. If position is an
    // integer, the file position will remain unchanged.
    console.log("read length: %d, position: %d", length, position);

    const pos = position || fd.position;
    const len = pos + length - 1;

    return fetch(fd.uri, {
      headers: {
        Range: `bytes=${pos}-${len}`
      }
    })
      .then(res => res.buffer())
      .then(buf => {
        buf.copy(buffer, offset);

        if (position == null) {
          fd.position += length - 1;
        }

        fd.bytesRead += length;

        callback(null, length, buffer);
      });
    return callback();
  },

  close: (fd, callback) => {
    console.log("%s bytes read:", fd.uri, fd.bytesRead);

    return callback();
  }
};
