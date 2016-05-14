var Promise = require('promise');
var config = require('./config');
var connPool = config.connPool;
var request = require('request');
var fs = require('fs');
var mkdirp = require('mkdirp');

var getHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var order = req.query.order;

    if (order == 'recommend') {
        getRecommendHandler(req, res, next);
        return;
    }

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    new Promise(function (resolve, reject) {
        // get user_id
        connPool.query('select id from user where auth_token = ?', [token], function (err, result) {

            if (err) {
                reject({ message: err.code });
                return;
            }

            if (result.length == 0) {
                reject({ code: 403, message: "invalid token" });
                return;
            }

            resolve({ user_id: result[0].id });
        });
    })
    .then(function (user) {

        return new Promise(function (resolve, reject) {

            connPool.query('select book.name, book.price, book.image_path, book_list.id, book_list.rent, book_list.comment, book_list.status, book_list.category, book_list.style from book, book_list where book.id = book_list.book_id and book_list.user_id = ?', [user.user_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                var books = []

                for (var i = 0; i < result.length; i++) {
                    books.push({
                        id: result[i].id,
                        name: result[i].name,
                        price: result[i].price,
                        image_path: result[i].image_path,
                        rent: result[i].rent,
                        comment: result[i].comment,
                        status: result[i].status,
                        category: result[i].category,
                        style: result[i].style,
                        images: []
                    });
                }

                resolve(books);
            });
        });
    })
    .then(function (books) {

        if (books.length == 0)
            return books;

        return new Promise(function (resolve, reject) {

            var index = 0;

            function getBookImages(book) {

                connPool.query('select id, image_path from book_image_list where book_id = ?', [book.id], function (err, result) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    for (var i = 0; i < result.length; i++) {
                        book.images.push({
                            image_id: result[i].id,
                            image_path: result[i].image_path
                        });
                    }

                    if (++index == books.length)
                        resolve(books);
                    else
                        getBookImages(books[index]);
                });
            }

            getBookImages(books[index]);

        });
    })
    .then(function (books) {
        var obj = {
            "message": "OK",
            "data": books
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var getRecommendHandler = function (req, res, next) {

    new Promise(function (resolve, reject) {

        connPool.query('select book_list.id, book.name, book.image_path, book_list.rent, book_list.comment, user.fb_avatar  from book, book_list, user where book.id = book_list.book_id and book_list.id in (select max(book_list.id) from book_list group by book_list.user_id order by max(book_list.id) DESC) and book_list.user_id = user.id', function (err, result) { 

            var books = []

            if (err) {
                reject({ message: err.code });
                return;
            }

            for (var i = 0; i < result.length; i++) {
                books.push({
                    id: result[i].id,
                    name: result[i].name,
                    image_path: result[i].image_path,
                    rent: result[i].rent,
                    comment: result[i].comment,
                    avatar: result[i].fb_avatar,
                    images: []
                });
            }

            resolve(books)
        });
    })
    .then(function (books) {

        if (books.length == 0)
            return books;

        return new Promise(function (resolve, reject) {

            var index = 0;

            function getBookImages(book) {

                connPool.query('select id, image_path from book_image_list where book_id = ?', [book.id], function (err, result) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    for (var i = 0; i < result.length; i++) {
                        book.images.push({
                            image_id: result[i].id,
                            image_path: result[i].image_path
                        });
                    }

                    if (++index == books.length)
                        resolve(books);
                    else
                        getBookImages(books[index]);
                });
            }

            getBookImages(books[index]);

        });
    })
    .then(function (books) {

        var obj = {
            "message": "OK",
            "data": books
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}


var getDetailHandler = function (req, res, next) {
    var book_id = req.params.book_id;

    new Promise(function (resolve, reject) {

        connPool.query('select book.name, book.author, book.publisher, book.publish_date, book.price, book.image_path, book_list.id, book_list.rent, book_list.comment, book_list.status, store.id as store_id, store.name as store_name, store.description as store_description, user.fb_avatar, user.firebase_uid from book, book_list, store_list, store, user where book.id = book_list.book_id and book_list.id = ? and book_list.user_id = store_list.user_id and book_list.user_id = user.id and store_list.store_id = store.id ', [book_id], function (err, result) {

            if (err) {
                reject({ message: err.code });
                return;
            }

            if (result.length == 0) {
                reject({ code: 404, message: 'book not found' });
                return;
            }

            if (result.length > 1) {
                reject({ message: 'book conflict' });
                return;
            }

            var books = []

            for (var i = 0; i < result.length; i++) {
                books.push({
                    id: result[i].id,
                    name: result[i].name,
                    author: result[i].author,
                    publisher: result[i].publisher,
                    publish_date: result[i].publish_date,
                    price: result[i].price,
                    image_path: result[i].image_path,
                    rent: result[i].rent,
                    comment: result[i].comment,
                    status: result[i].status,
                    store: {
                        store_id: result[i].store_id,
                        store_name: result[i].store_name,
                        description: result[i].store_description,
                        avatar: result[i].fb_avatar
                    },
                    owner: {
                        avatar: result[i].fb_avatar,
                        firebase_uid: result[i].firebase_uid
                    },
                    images: []
                });
            }

            resolve(books[0]);
        });
    })
    .then(function (book) {

        return new Promise(function (resolve, reject) {

            connPool.query('select id, image_path from book_image_list where book_id = ?', [book.id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                for (var i = 0; i < result.length; i++) {
                    book.images.push({
                        image_id: result[i].id,
                        image_path: result[i].image_path
                    });
                }

                resolve(book);
            });
        });
    })
    .then(function (book) {
        var obj = {
            "message": "OK",
            "data": book
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var getImageHandler = function (req, res, next) {
    next();
}

var postHandler = function (req, res, next) {
    var token = req.query.auth_token
    var isbn = req.body.isbn;
    var user_id = 0;

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    if (isbn == undefined) {
        var obj = { message: "no necessary colums" };

        res.status(400).json(obj);
        return;
    }

    new Promise(function (resolve, reject) {
        // get user_id
        connPool.query('select id from user where auth_token = ?', [token], function (err, result) {

            if (err) {
                reject({ message: err.code });
                return;
            }

            if (result.length == 0) {
                reject({ code: 403, message: "invalid token" });
                return;
            }

            user_id = result[0].id;

            resolve();
        });
    })
    .then(function () {

        return new Promise(function (resolve, reject) {
            // get isbn
            connPool.query('select * from book where isbn = ?', [isbn], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                var books = []

                for (var i = 0; i < result.length; i++) {
                    books.push({
                        id: result[i].id,
                        isbn: result[i].isbn,
                        name: result[i].name,
                        author: result[i].author,
                        publisher: result[i].publisher,
                        publish_date: result[i].publish_date,
                        price: result[i].price,
                        image_path: result[i].image_path
                    });
                }

                resolve(books);
            });
        });
    })
    .then(function (books) {

        if (books.length > 0) {
            return books;
        }

        return new Promise(function (resolve, reject) {
            var yql = "select * from html where url='http://search.books.com.tw/exep/prod_search.php?key="+ isbn +"&cat=all' and xpath='//*[@id=\"searchlist\"]/ul'"
            var param = {
                q: yql,
                format: 'json'
            };

            request({ url: 'https://query.yahooapis.com/v1/public/yql', qs: param }, function (err, response, body) {

                if (err) {
                    reject({ message: err });
                    return;
                }

                try {
                    var results = JSON.parse(body).query.results;
                    var li_tag = results.ul.li

                    function parseContent(root) {
                        var name = root.h3.a.content;
                        var author = [];
                        var publisher = [];
                        var date;
                        var match = root.content.match(/(\d+)-(\d+)-(\d+)/);
                        var price;
                        var image;

                        if (match && match.length > 0)
                            date = match[0]; 

                        if (root.a instanceof Array) {
                            for (var i = 0; i < root.a.length; i++) {
                                var a_tag = root.a[i];

                                if (a_tag.rel) {
                                    if (a_tag.rel.indexOf('author') >= 0) {
                                        author.push(a_tag.content);
                                    } else if (a_tag.rel.indexOf('publish') >= 0) {
                                        publisher.push(a_tag.content);
                                    } else if (a_tag.rel.indexOf('image') >= 0) {
                                        image = a_tag.img['data-original'];
                                    }
                                }
                            }
                        }

                        if (root.span instanceof Array) {
                            for (var i = 0; i < root.span.length; i++) {
                                if (root.span[i].class == "price") {
                                    if (root.span[i].b)
                                        price = root.span[i].b
                                    else if (root.span[i].strong && root.span[i].strong.b instanceof Array)
                                        price = root.span[i].strong.b[1];
                                    else if (root.span[i].strong && root.span[i].strong.b)
                                        price = root.span[i].strong.b
                                }
                            }
                        }

                        books.push({
                            isbn: isbn,
                            name: name,
                            author: author.join(', '),
                            publisher: publisher.join(', '),
                            publish_date: date,
                            price: price,
                            image_path: image
                        });
                    }

                    if (li_tag instanceof Array) {
                        for (var i = 0; i < li_tag.length; i++) {
                            parseContent(li_tag[i]);
                        }
                    } else {
                        parseContent(li_tag);
                    }

                    if (books.length > 0) {
                        resolve(books);
                    } else {
                        reject({ code: 400, message: 'isbn not found' });
                    }
                } catch(err) {

                    reject({ message: err.message });
                }
            });
        });
    })
    .then(function (books) {

        if (books.length == 0 || books[0].id) {
            return books;
        }

        // update to database
        return new Promise(function (resolve, reject) {

            function insertTable(index) {

                if (index >= books.length) {
                    resolve(books);
                    return;
                }

                connPool.query('insert into book set ?', [books[index]], function (err, result) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    books[index].id = result.insertId;
                    insertTable(index + 1);
                });
            }

            insertTable(0);
        });
    })
    .then(function (books) {

        return new Promise(function (resolve, reject) {

            function getBookID(index) {

                if (index >= books.length) {
                    resolve(books);
                    return;
                }

                var book_list = {
                    book_id: books[index].id,
                    user_id: user_id
                };

                connPool.query('insert into book_list set ?', [book_list], function (err, result) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    books[index].id = result.insertId;
                    getBookID(index + 1);
                });
            }

            getBookID(0);
        });
    })
    .then(function (books) {
        var obj = {
            "message": "OK",
            "data": books
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var postImageHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var book_id = req.params.book_id;

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    if (!req.file) {
        var obj = { message: "no file" };

        res.status(400).json(obj);
        return;
    }

    new Promise(function (resolve, reject) {
        // check auth_token
        connPool.query('select id from user where auth_token = ?', [token], function (err, result) {

            if (err) {
                reject({ message: err.code });
                return;
            }

            if (result.length == 0) {
                reject({ code: 403, message: "invalid token" });
                return;
            }

            resolve({ user_id: result[0].id })
        });
    })
    .then(function (user) {
        // check book owner
        return new Promise(function (resolve, reject) {
            connPool.query('select id from book_list where id = ? and user_id = ?', [book_id, user.user_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                if (result.length == 0) {
                    reject({ code: 403, message: 'invalid owner' });
                    return;
                }

                resolve();
            });
        });
    })
    .then(function () {
        // save book image to disk
        var image_name = req.file.filename + '.jpg';
        var image_folder = '/images/user_books/' + book_id;
        var image_path = image_folder + '/' + image_name;
        var source_path = req.file.path;
        var target_folder = __dirname + '/../../public' + image_folder
        var target_path = target_folder + '/' + image_name;

        return new Promise(function (resolve, reject) {

            mkdirp(target_folder, function (err) {

                if (err) {
                    reject({ message: "mkdirp failed" });
                    return;
                }

                fs.rename(source_path, target_path, function (err) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    resolve({
                        book_id: book_id,
                        image_path: config.imageHost + image_path
                    });
                });
            });
        });
    })
    .then(function (value) {
        // insert image path to DB
        return new Promise(function (resolve, reject) {

            connPool.query('insert into book_image_list set ?', [value], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                resolve({
                    image_id: result.insertId,
                    image_path: value.image_path
                });
            });
        });
    })
    .then(function (value) {

        var obj = {
            "message": "OK",
            "data": value
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {

        if (req.file.path) {
            fs.unlink(req.file.path, function (err) {});
        }

        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var putHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var book_id = req.params.book_id;
    var book = {};

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    if (req.body.rent) {
        book.rent = req.body.rent;
    }

    if (req.body.comment) {
        book.comment = req.body.comment;
    }

    if (req.body.status) {
        book.status = req.body.status;
    }

    if (req.body.category) {
        book.category = req.body.category;
    }

    if (req.body.style) {
        book.style = req.body.style;
    }

    if (Object.getOwnPropertyNames(book).length == 0) {
        var obj = { message: "no update colums" };

        res.status(400).json(obj);
        return;
    }

    new Promise(function (resolve, reject) {
        // get user_id
        connPool.query('select id from user where auth_token = ?', [token], function (err, result) {

            if (err) {
                reject({ message: err.code });
                return;
            }

            if (result.length == 0) {
                reject({ code: 403, message: "invalid token" });
                return;
            }

            resolve({ user_id: result[0].id });
        });
    })
    .then(function (user) {

        return new Promise(function (resolve, reject) {

            connPool.query('update book_list set ? where id = ? and user_id = ?', [book, book_id, user.user_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                if (result.affectedRows == 0) {
                    reject({ code: 500, message: 'no affected rows' }); 
                    return;
                }

                resolve();
            });
        });
    })
    .then(function () {
        var obj = {
            "message": "OK"
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
};

var deleteHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var book_id = req.params.book_id;

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    new Promise(function (resolve, reject) {
        // get user_id
        connPool.query('select id from user where auth_token = ?', [token], function (err, result) {

            if (err) {
                reject({ message: err.code });
                return;
            }

            if (result.length == 0) {
                reject({ code: 403, message: "invalid token" });
                return;
            }

            resolve({ user_id: result[0].id });
        });
    })
    .then(function (user) {

        return new Promise(function (resolve, reject) {

            connPool.query('delete from book_list where id = ? and user_id = ?', [book_id, user.user_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                if (result.affectedRows == 0) {
                    reject({ code: 500, message: 'no affected rows' }); 
                    return;
                }

                resolve();
            });
        });
    })
    .then(function () {
        var obj = {
            "message": "OK"
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var deleteImageHandler = function (req, res, next) {
    next();
}

module.exports = {
    GET: getHandler,
    GET_DETAIL: getDetailHandler,
    GET_IMAGES: getImageHandler,
    POST: postHandler,
    POST_IMAGES: postImageHandler,
    PUT: putHandler,
    DELETE: deleteHandler,
    DELETE_IMAGES: deleteImageHandler
}

