var vumigo = require("vumigo_v02");
var AppTester = vumigo.AppTester;

describe("ussd_sassa_registration app", function () {
  var app;
  var tester;

  beforeEach(function () {
    app = new go.app.GoApp();
    tester = new AppTester(app);
    tester.setup.config.app({});
    tester.setup.char_limit(2000);
  });
  describe("state_start", function () {
    it("should ask the user if they want to apply", function () {
      return tester
        .start()
        .check.interaction({
          state: "state_start",
          reply: [
            "*Welcome, SASSA is here to help!* SASSA is offering relief to " +
              "those in need as part of the Social Relief of Distress (SRD) " +
              "programme.",
            "",
            "1. *About* _this grant_",
            "2. *Apply*"
          ].join("\n")
        })
        .run();
    });
    it("should display an error on invalid input", function () {
      return tester
        .input("error")
        .check.interaction({
          state: "state_start",
          reply: [
            "Please respond with one of the numbers below or type *EXIT* to " +
              "end this application. Please note that if you choose to *EXIT*, " +
              "your information will not be saved but you can restart the " +
              "application process",
            "",
            "1. *About* _this grant_",
            "2. *Apply*"
          ].join("\n")
        })
        .run();
    });
  });
});
