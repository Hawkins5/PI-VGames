var express = require("express");
const { apikey, Videogame, Genre, conn } = require("../db");
var router = express.Router();
const axios = require("axios");

router.get("/", async (req, res) => {
  const { name } = req.query;
  //Buscador de videojuegos:
  try {
    if (name) {
      let sname = name.split(" ").join("-").toLowerCase();
      var apiresult = await axios.get(
        `https://api.rawg.io/api/games?search=${sname}&key=${apikey}&page_size=100`
      );
      apiresult = apiresult.data.results;
    } else {
      async function SearchApi() {
        try {
          const promise1 = axios.get(
            `https://api.rawg.io/api/games?key=${apikey}&page=1&page_size=50`
          );
          const promise2 = axios.get(
            `https://api.rawg.io/api/games?key=${apikey}&page=2&page_size=50`
          );
          const promise3 = axios.get(
            `https://api.rawg.io/api/games?key=${apikey}&page=3&page_size=50`
          );

          await Promise.all([promise1, promise2, promise3]).then(function (
            values
          ) {
            apiresult = values[0].data.results
              .concat(values[1].data.results)
              .concat(values[2].data.results);
          });
        } catch (err) {
          console.log("Error searchin the API: ", err);
        }
      }
      await SearchApi();
    }
    if (apiresult.length > 0) {
      var apivgames = apiresult.map((p) => {
        let b = [];
        for (i = 0; i < p.genres.length; i++) {
          b.push(p.genres[i].name);
        }
        return {
          id: p.id,
          name: p.name,
          image: p.background_image,
          genres: b.toString(),
          rating: p.rating,
          origin: "API",
        };
      });
      if (name) {
        apivgames = apivgames.filter((p) =>
          p.name.toLowerCase().includes(name.toLowerCase())
        );
      }
    } else var apivgames = [];

    //Ahora desde la base de datos local:
    var dbvgames = [];
    dbvgames = await Videogame.findAll({
      include: {
        model: Genre,
        attributes: ["name"],
        through: { attributes: [] },
      },
    });
    if (name) {
      dbvgames = dbvgames.filter((p) =>
        p.name.toLowerCase().includes(name.toLowerCase())
      );
    }
    var dbvgames = dbvgames.map((p) => {
      let b = [];
      for (i = 0; i < p.genres.length; i++) {
        b.push(p.genres[i].name);
      }
      return {
        id: p.id,
        name: p.name,
        image:
          "https://media.rawg.io/media/games/157/15742f2f67eacff546738e1ab5c19d20.jpg",
        genres: b.toString(),
        rating: p.rating,
        origin: "DB",
      };
    });
    //Mostrar todos los videojuegos:
    const allvgames = dbvgames.concat(apivgames);
    res.json(allvgames.length ? allvgames : "No videogames found");
  } catch (error) {
    res.send(`Error in route /videogames ${error}`);
  }
});

//Buscar por ID:
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!isNaN(id)) {
      var idkey = parseInt(id);
      const result = await axios.get(
        `https://api.rawg.io/api/games/${idkey}?key=${apikey}`
      );
      if (result.data.id) {
        let genrestr = [];
        for (i = 0; i < result.data.genres.length; i++) {
          genrestr.push(result.data.genres[i].name);
        }
        let platformstr = [];
        for (i = 0; i < result.data.platforms.length; i++) {
          platformstr.push(result.data.platforms[i].platform.name);
        }
        const searchapivg = {
          name: result.data.name,
          platforms: platformstr.toString(),
          released: result.data.released,
          image: result.data.background_image,
          description: result.data.description.replace(/<[^>]+>/g, ""),
          rating: result.data.rating,
          genres: genrestr.toString(),
        };
        return res.status(200).json(searchapivg);
      }
    }
    //Desde la Base de Datos local por ID:
    var searchdbvg = await Videogame.findByPk(id, {
      include: [
        {
          model: Genre,
          attributes: ["name"],
          through: {
            attributes: [],
          },
        },
      ],
    });

    if (searchdbvg) {
      let genrestr = [];
      for (let i = 0; i < searchdbvg.genres.length; i++) {
        genrestr.push(searchdbvg.genres[i].name);
      }
      const objdbgame = {
        name: searchdbvg.name,
        platforms: searchdbvg.platform, //platform
        released: searchdbvg.reldate, //reldate
        image:
          "https://media.rawg.io/media/games/157/15742f2f67eacff546738e1ab5c19d20.jpg",
        description: searchdbvg.description,
        rating: searchdbvg.rating,
        genres: genrestr.toString(),
      };
      return res.status(200).json(objdbgame);
    }
    return res.status(404).send("Videogame not found");
  } catch (error) {
    res.send(`Error in Rute /videogames:id ${error}`);
  }
});

//Eliminar videojuego:
router.post("/delete/:name", async (req, res) => {
  const { name } = req.params;
  console.log("Delete de: ", name);
  try {
    const elem = await Videogame.destroy({
      where: { name: `${name}` },
    });
  } catch (error) {
    res.send(`Error in route /videogames/delete ${error}`);
  }
  res.send("Videogame has been deleted");
});

//Añadir videojuego:
router.post("/", async (req, res) => {
  let { name, description, reldate, rating, platform, genre } = req.body;
  platform = platform.toString();
  const addVgame = await Videogame.create({
    name,
    description,
    reldate,
    rating,
    platform,
  });

  //Buscar generos de la base de datos:
  const vg_genre = await Genre.findAll({
    where: { name: genre },
  });
  //Generate Table association Videogame-Genres link
  addVgame.addGenre(vg_genre);

  res.send("New video game has been added");
});

module.exports = router;
