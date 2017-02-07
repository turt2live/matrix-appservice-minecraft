var cache = require("./src/UuidCache");

cache.lookupFromUuid('c465b154-3c29-4dbf-a7e3-e0869504b8d8').then(profile=>{
    console.log(profile);
}, error=>{
    console.error("ERR");
    console.error(error);
});