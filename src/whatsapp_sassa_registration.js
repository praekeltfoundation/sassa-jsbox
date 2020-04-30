go.app = (function () {
  var vumigo = require("vumigo_v02");
  var App = vumigo.App;
  var MenuState = vumigo.states.MenuState;
  var Choice = vumigo.states.Choice;

  var GoApp = App.extend(function (self) {
    App.call(self, "state_start");
    var $ = self.$;

    self.states.add("state_start", function (name, opts) {
      // Reset user answers when restarting the app
      self.im.user.answers = {};

      return new MenuState(name, {
        question: $(
          [
            "*Welcome, SASSA is here to help!* SASSA is offering relief to " +
              "those in need as part of the Social Relief of Distress (SRD) " +
              "programme.",
            ""
          ].join("\n")
        ),
        error: $(
          [
            "Please respond with one of the numbers below or type *EXIT* to " +
              "end this application. Please note that if you choose to " +
              "*EXIT*, your information will not be saved but you can " +
              "restart the application process",
            ""
          ].join("\n")
        ),
        accept_labels: true,
        choices: [
          new Choice("state_start", $("*About* _this grant_")),
          new Choice("state_start", $("*Apply*"))
        ],
        next: "state_resident"
      });
    });
  });
  return {
    GoApp: GoApp
  };
})();
