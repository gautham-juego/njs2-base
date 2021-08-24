const path = require("path");
baseInitialize = require('./baseInitialize.class');
baseAction = require("./baseAction.class");
basePkg = require("./basePackage.class");
glbvalue = require(path.join(process.cwd(), "src/global/index.js"));


require("./env");

const requireDir = require('require-dir');
const Autoload = require('./autoload.class');
const { encrypt, decrypt } = require("./encryption");
const ParameterProcessor = require('./parameterProcessor.class');
const dbManager = require("../package/dbManager").dbManager;
const httpRequest = require(path.join(process.cwd(), "src/config/route.json"));
const { ENCRYPTION_MODE } = JSON.parse(process.env.ENCRYPTION);
const ENC_MODE = require('../lib/constants')
const jwt = require('../package/jwt');


const baseMethodsPath = path.join(process.cwd(), "src/methods/");
class executor extends baseAction {

  constructor() {
    super();
    this.responseData = {};
  }

  async executeRequest(request) {
    try {
      this.setResponse('UNKNOWN_ERROR');

      // Initializng basic variables
      const { lng_key: lngKey, access_token: accessToken, enc_state: encState } = request.headers;
      const encryptionState = (ENCRYPTION_MODE == ENC_MODE.STRICT || (ENCRYPTION_MODE == ENC_MODE.OPTIONAL && encState == ENC_MODE.ENABLED));
      if (lngKey) this.setMemberVariable('lng_key', lngKey);
      this.setMemberVariable('encryptionState', encryptionState);

      // Finalize methodName including custom route
      let methodName = this.getMethodName(request.pathParameters);

      request.pathParameters = null;
      const { customMethodName, pathParameters } = this.getCustomRoute(methodName);
      if (customMethodName) {
        request.pathParameters = pathParameters;
        methodName = customMethodName;
      }

      // Resolve path from methodName
      let pathName = this.getMethodPath(methodName);
      if (!this.methodExists(pathName)) {
        this.setResponse('METHOD_NOT_FOUND');
        return false;
      }

      // Include required files and initiate instances
      const { action: ActionClass, init: InitClass } = requireDir(pathName);
      const initInstance = new InitClass();
      const actionInstance = new ActionClass();
      if (lngKey) {
        actionInstance.setMemberVariable('lng_key', lngKey);
      }

      // Validate request method with initializer
      if (!this.isValidRequestMethod(request.httpMethod, initInstance.pkgInitializer.requestMethod)) {
        this.setResponse('INVALID_REQUEST_METHOD');
        return false;
      }

      // if secured endpoint validate access token
      if (initInstance.pkgInitializer.isSecured) {
        const { error, data } = await this.validateAccesstoken(accessToken);
        if (error) {
          let options = [];
          options.paramName = error.parameterName;
          this.setResponse(error.errorCode, options);
          return false;
        }
        actionInstance.setMemberVariable('userObj', data);
      }

      // validate & process request parameters
      const parameterProcessor = new ParameterProcessor();
      const requestData = await parameterProcessor.processParameter(initInstance, request, encState);

      const params = initializer.getParameter();
      for (let i in params) {
        let param = params[i];
        const { error, data } = parameterProcessor.validateParameters(param, requestData[param.name]);
        if (error) {
          let options = [];
          options.paramName = error.parameterName;
          this.setResponse(error.errorCode, options);
          return false;
        }
        actionInstance.setMemberVariable(param.name, data);
      }

      // Initiate and Execute method
      this.responseData = await actionInstance.executeMethod();
      const { responseCode } = actionInstance.getResponseCode();
      // if (encryptionState) {
      //   this.responseData = encrypt(JSON.stringify(this.responseData));
      // }
      const responseMessage = this.getResponseMessage(responseCode)

      return {
        responseCode,
        responseMessage,
        responseData
      };

    } catch (e) {
      if (process.env.MODE == "DEV") this.setDebugMessage(e.message);
      console.log("Exception caught", e);
      return false;
    }
  }

  /** HELPER METHODS */

  getMethodName(pathParameters) {
    return pathParameters ? pathParameters.proxy : pathParameters;
  }

  getMethodPath(methodName) {
    let splitString = methodName.split("/");
    splitString = splitString.map((element, index) => {
      //Checking for index > 1 because if method name is "/user/detail" then second resource(detail) should
      //get converted to Pascal case "user" should be camel case
      if (index == 1) {
        element = `.${element}`;
      } else if (index > 1) {
        element = this.capitalizeFirstLetter(element);
      }
      return element;
    });

    return baseMethodsPath + splitString.join("");
  }

  getCustomRoute(methodName) {
    let pathParameters;
    const requestMap = httpRequest.filter(request => {
      const pathVal = request.path.replace(/\/:[a-z]+\w+/g, "");
      const pathParamVal = methodName.split(pathVal).filter((el) => el.length != 0).length
        ? methodName.split(pathVal).filter((el) => el.length != 0)[0].split('/').filter((el) => el.length != 0)
        : [];
      const pathParamKeys = request.path.match(/\/:[a-z]+\w+/g) ? request.path.match(/\/:[a-z]+\w+/g).map(paramKey => paramKey.replace('/:', '')) : [];
      if (pathParamKeys.length == 0 && pathVal == methodName) {
        return true;
      } else if (methodName.search(pathVal) == 0 && pathParamKeys.length == pathParamVal.length) {
        pathParameters = {};
        pathParamKeys.map((key, index) => {
          pathParameters[key] = pathParamVal[index];
        });
        return true;
      }
      return false;
    });

    if (requestMap.length != 0) {
      return { customMethodName: requestMap[0].methodName, pathParameters };
    }
    return {};
  }

  // TODO: In future we will move this to an Authorization class
  validateAccesstoken = async (accessToken) => {
    let validationResponse = { error: null, data: {} };
    if (!accessToken || typeof accessToken != "string" || accessToken.trim() == "") {
      // let options = [];
      // options.paramName = 'access_token';
      // this.setResponse("INVALID_INPUT_EMPTY", options);
      validationResponse.error = { errorCode: "INVALID_INPUT_EMPTY", parameterName: 'access_token' };
      return validationResponse;
    }

    if (this.encryptionState)
      accessToken = decrypt(accessToken);

    const { AUTH_MODE, JWT_SECRET, JWT_ID_KEY, DB_ID_KEY, DB_TABLE_NAME, DB_ACCESS_KEY } = JSON.parse(process.env.AUTH);
    const decodedVal = await jwt.decodeJwtToken(accessToken, JWT_SECRET);

    if (!decodedVal || !decodedVal[JWT_ID_KEY]) {
      validationResponse.error = { errorCode: "INVALID_INPUT_EMPTY", parameterName: 'access_token' };
      return validationResponse;
    }

    if (AUTH_MODE == "JWT_DB") {
      const verifedUser = await dbManager.find(DB_TABLE_NAME, { [DB_ACCESS_KEY]: accessToken, [DB_ID_KEY]: decodedVal[JWT_ID_KEY] });
      if (verifedUser.length > 0) {
        //return verifedUser[0];
        validationResponse.data = verifedUser[0];
        return validationResponse;
      };
    } else {
      validationResponse.data = { [DB_ID_KEY]: decodedVal[JWT_ID_KEY] };
      return validationResponse;
    }

  }

  capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  getResponse() {
    const response = {
      responseCode: Autoload.responseCode,
      responseMessage: Autoload.responseMessage,
      responseData: this.responseData,
    }
    return response;
  }

  isValidRequestMethod(httpMethod, requestMethod) {
    if (httpMethod.toUpperCase() !== requestMethod.toUpperCase()) {
      return false;
    }
    return true;
  }

  methodExists(pathName) {
    try {
      requireDir(pathName);
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = executor;