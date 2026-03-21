const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { userModel } = require("../models/user");
const { sendVerificationMail } = require("../config/mail");
const {
  verifyEmailTemplate,
  alreadyRegisteredTemplate,
  notInRecordsTemplate,
} = require("../tamplates/mailTemplates");
const {
  generateToken,
  storeToken,
  verfiyAndDeleteToken,
} = require("../services/verificationToken");
const universityDb = require("../university_data.json");

const findStudentInUniDb = (enrollmentNumber) =>
  universityDb.students.find(
    (s) => s.enrollmentNumber.toUpperCase() === enrollmentNumber.toUpperCase(),
  ) || null;

const findSeniorInUniDb = (email) =>
  universityDb.seniors.find(
    (s) => s.emailId.toLowerCase() === email.toLowerCase(),
  ) || null;

const login = async (req, res) => {
  try {
    const errMsg = "Invalid credentials";
    const { role, password } = req.body;

    let emailId;

    if (!role) {
      return res.status(400).json({ message: "Bad request", success: false });
    } else if (role === "student") {
      const { enrollmentNumber } = req.body;
      emailId = enrollmentNumber.toLowerCase() + "@curaj.ac.in";
    } else if (role === "senior") {
      emailId = req.body.emailId?.toLowerCase();
    } else {
      return res.status(400).json({ message: "Bad request", success: false });
    }
    const user = await userModel.findOne({ emailId });

    if (!user) {
      const isPassCorrect = await bcrypt.compare(password, "polkadots");
      return res.status(403).json({ message: errMsg, success: false });
    }

    const isPassCorrect = await bcrypt.compare(password, user.passwordHash);

    if (!isPassCorrect) {
      return res.status(403).json({ message: errMsg, success: false });
    }

    const jwtToken = jwt.sign(
      { emailId: user.emailId, _id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: 3600 },
    );

    return res.status(202).json({
      message: "Login successful",
      success: true,
      jwtToken,
    });
  } catch (err){
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

const signup = async (req, res) => {
  try {
    const resMessage = "Please check your email inbox for further instructions";
    const { role } = req.body;

    if (role === "student") {
      const { enrollmentNumber, password } = req.body;
      const emailId = enrollmentNumber + "@curaj.ac.in";

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await userModel.findOne({
        $or: [{ enrollmentNumber }, { emailId }],
      });
      const uniRecord = findStudentInUniDb(enrollmentNumber);
      const verficationToken = generateToken();

      if (user) {
        sendVerificationMail(
          emailId,
          alreadyRegisteredTemplate(
            emailId,
            "http://localhost:8080/auth/login",
          ),
        );
        return res.status(202).json({ message: resMessage, success: true });
      }

      if (!uniRecord) {
        sendVerificationMail(emailId, notInRecordsTemplate(emailId));
        return res.status(202).json({ message: resMessage, success: true });
      } else {
        const userPayload = {
          userData: uniRecord,
          passwordHash,
          role,
          createdAt: Date.now(),
        };
        await storeToken(verficationToken.tokenHash, userPayload);
        sendVerificationMail(
          emailId,
          verifyEmailTemplate(
            "http://10.50.12.123/auth/verify/" +
              `${verficationToken.rawToken}`,
          ),
        );
        return res.status(202).json({ message: resMessage, success: true });
      }
    } else if (role === "senior") {
      const { emailId: identifier, password } = req.body;

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await userModel.findOne({ emailId: identifier });
      const uniRecord = findSeniorInUniDb(identifier);
      const verficationToken = generateToken();

      if (user) {
        sendVerificationMail(
          identifier,
          alreadyRegisteredTemplate(
            identifier,
            "http://localhost:8080/auth/login",
          ),
        );
        return res.status(202).json({ message: resMessage, success: true });
      }

      if (!uniRecord) {
        sendVerificationMail(identifier, notInRecordsTemplate(identifier));
        return res.status(202).json({ message: resMessage, success: true });
      } else {
        const userPayload = {
          userData: uniRecord,
          passwordHash,
          role,
          createdAt: Date.now(),
        };
        await storeToken(verficationToken.tokenHash, userPayload);
        sendVerificationMail(
          identifier,
          verifyEmailTemplate(
            "http://localhost:8080/auth/verify/" +
              `${verficationToken.rawToken}`,
          ),
        );
        return res.status(202).json({ message: resMessage, success: true });
      }
    } else {
      return res.status(400).json({ message: "Invalid Role", success: false });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

const verify = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;

    if (!token) {
      return res.status(400).json({ message: "Invalid token", success: false });
    }

    const payload = await verfiyAndDeleteToken(token);
    const parsedPayload =
      typeof payload === "string" ? JSON.parse(payload) : payload;

    if (!parsedPayload) {
      return res
        .status(400)
        .json({ message: "Invalid or expired token", success: false });
    }

    const { passwordHash, userData, role } = parsedPayload;
    const createPayload = {
      name: userData.name,
      emailId: userData.emailId,
      passwordHash,
      role,
      department: userData.department,
    };

    if (role === "student") {
      createPayload.dob = new Date(userData.dob);
      createPayload.enrollmentNumber = userData.enrollmentNumber;
    } else if (role === "senior") {
      createPayload.employeeId = userData.employeeId;
      createPayload.designation = userData.designation;
    } else {
      return res
        .status(500)
        .json({ message: "Internal Server Error", success: false });
    }

    await userModel.create(createPayload);
    return res
      .status(201)
      .json({ message: "User registered successfully", success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

module.exports = { signup, login, verify };
