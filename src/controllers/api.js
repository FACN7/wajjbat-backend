const jwt = require("jsonwebtoken");
const { calculatDestance } = require("../../helpers/calculatDestance");
const { getBusinesses, topRating } = require("../queries/getBusinesses");
const {
  getBusinesseImages,
  getBusinesseReviews,
  getAllFromBusinesse,
  getBusinesseAvgRating
} = require("../queries/getBusinessesById");
const { addNewReview } = require("../queries/addNewReview");
const { findUser } = require("../queries/findUser");
const { addNewUser } = require("../queries/addNewUser");
const {
  addNewBussines,
  getId,
  addImage
} = require("../queries/addNewBusiness");
const { bussinessList } = require("../queries/getAllBusinesses");
const { getReviewByUser } = require("../queries/getReviewByUser");
const { getaUserById } = require("../queries/getaUserById");

exports.businesses = async (req, res) => {
  const userLocation = req.body;
  try {
    const result = await getBusinesses();
    const tops = await topRating();
    const topsWithoutNullRating = tops.rows.filter(
      ({ rating }) => rating !== null
    );
    // businessWithDestince include business with Cfrom user location
    let businessWithDistance = [];
    // this foreach creat arrays whitch business details include sortByDist
    // calculatDestance is a function from geolib package that calculat distance between 2 points
    result.rows.forEach(business => {
      const { lat, lng } = business;
      const businessLocation = { lat, lng };
      const distance = calculatDestance(businessLocation, userLocation);
      businessWithDistance = [
        ...businessWithDistance,
        { ...business, distance, image: business.primaryimage }
      ];
    });
    // this function sorts business by distance from user location
    const sortByDist = businessWithDistance.sort(
      (a, b) => a.distance - b.distance
    );

    // this is the data that we return to the browser
    // [topsWithoutNullRating] witch is the top 5 rating businnes
    //  [sortByDist] : sortting business by distance from user location
    res.status(200).json({
      topRated: topsWithoutNullRating,
      businesses: sortByDist
    });
  } catch (err) {
    console.log("Error on businesses", err);
  }
};

exports.businessesId = async (req, res) => {
  const id = req.params.id;
  try {
    const { rows: allBusinessImages } = await getBusinesseImages(id);
    let { rows: businessReviews } = await getBusinesseReviews(id);
    const { rows: business } = await getAllFromBusinesse(id);
    let { rows: businesseAvgRating } = await getBusinesseAvgRating(id);

    // sometimes businesseAvgRating is null , so we must check this option. if its not we concat it to the business info
    // we want to avoid the case of 3.3333333 so we use Math.round to fix it .

    businesseAvgRating = Math.round(businesseAvgRating[0].avg);
    const businesseWithRate = {
      ...business[0],
      rating: businesseAvgRating === 0 ? null : businesseAvgRating
    };

    // to fix the date and concat the result to items
    businessReviews = businessReviews.map(item => {
      return {
        ...item,
        dateCreated: item.datecreated.toISOString().split("T")[0],
        datecreated: undefined
      };
    });

    // finally, this is the result that we return
    res.json({
      primaryImage: business[0].primaryimage,
      subImages: allBusinessImages.map(item => item.image_url),
      details: businesseWithRate,
      reviews: [businessReviews][0]
    });
  } catch (err) {
    console.log(err);
  }
};

exports.newBusiness = async (req, res) => {
  try {
    const data = req.body;
    await addNewBussines(data);
    const { rows: id } = await getId();
    const businessId = id[0].max;
    data.subImgs.forEach(async img => {
      await addImage(businessId, img);
    });
    res.status(200).send({
      success: true,
      msg: "New Business added"
    });
  } catch (err) {
    console.log("added business", err);
    res.status(500);
  }
};

exports.newReview = (req, res) => {
  const data = req.body;
  addNewReview(data)
    .then(res.status(200).send("the data added successfully"))
    .catch(err => console.log(err));
};

const googleFacebookHandle = async (user, res) => {
  try {
    const { rows: currentUser } = await findUser(user.email);

    if (Object.keys(user).length > 0) {
      if (Object.keys(currentUser).length > 0) {

        // add id in the cookie 
        res.cookie("access_token",
          jwt.sign({ email: user.email }, process.env.JWT_SECRET), { maxAge: 1000 * 60 * 60, });

        res.status(200).json({
          success: true,
          msg: "The user already exist"
        });
      } else {
        await addNewUser(
          user.name.split(" ")[0],
          user.name.split(" ")[1],
          user.email,
          user.url
        );

        // add id in the cookie
        res.cookie(
          "access_token",
          jwt.sign({ user: user.name }, process.env.JWT_SECRET),
          { maxAge: 2 * 60 * 60 * 1000, httpOnly: true }
        );

        res.status(200).json({
          success: true,
          msg: "New user created"
        });
      }
    } else {
      res.status(400).json({
        success: false,
        msg: "Error"
      });
    }
  } catch (err) {
    console.log(err);
  }
};

exports.googleFacebook = async (req, res, next) => {
  try {
    await googleFacebookHandle(req.body, res);
  } catch (error) {
    res.status(400).json({
      success: false,
      msg: "Error"
    });
  }
};

exports.businessesList = async (req, res) => {
  try {
    const { rows: busList } = await bussinessList(req.id);
    res.send(busList);
  } catch (err) {
    console.log(err);
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    let { rows: user } = await getaUserById(req.id);
    let { rows: reviews } = await getReviewByUser(req.id);
    reviews = reviews.map(obj => {
      return {
        ...obj,
        reviewdate: obj.reviewdate.toISOString().split("T")[0]
      };
    });
    res.json({
      userDetails: {
        firstName: user[0].first_name,
        lastName: user[0].last_name,
        profilePic: user[0].profile_image
      },
      reviews: reviews
    });
  } catch (err) {
    console.log(err);
  }
};
