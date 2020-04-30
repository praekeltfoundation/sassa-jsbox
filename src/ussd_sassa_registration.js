go.app = (function () {
  var _ = require("lodash");
  var moment = require("moment");
  var vumigo = require("vumigo_v02");
  var App = vumigo.App;
  var Choice = vumigo.states.Choice;
  var EndState = vumigo.states.EndState;
  var MenuState = vumigo.states.MenuState;
  var FreeText = vumigo.states.FreeText;
  var ChoiceState = vumigo.states.ChoiceState;
  var JsonApi = vumigo.http.api.JsonApi;
  var utils = require("seed-jsbox-utils").utils;

  var GoApp = App.extend(function (self) {
    App.call(self, "state_start");
    var $ = self.$;

    self.add = function (name, creator) {
      self.states.add(name, function (name, opts) {
        if (self.im.msg.session_event !== "new") return creator(name, opts);

        var timeout_opts = opts || {};
        timeout_opts.name = name;
        return self.states.create("state_timed_out", timeout_opts);
      });
    };

    self.states.add("state_timed_out", function (name, creator_opts) {
      return new MenuState(name, {
        question: $("Welcome back. Do you want to:"),
        choices: [
          new Choice(creator_opts.name, $("Continue where you left off")),
          new Choice("state_start", $("Start again"))
        ]
      });
    });

    self.states.add("state_start", function (name, opts) {
      // Reset user answers when restarting the app
      self.im.user.answers = {};

      return new ChoiceState(name, {
        question: $(
          [
            "Welcome. SASSA is offering food grants to those who qualify.",
            "Is this application for your or someone else?"
          ].join("\n")
        ),
        error: $(
          [
            "Please use the numbers to choose one of the options below.",
            "",
            "Is this application for your or someone else?"
          ].join("\n")
        ),
        accept_labels: true,
        choices: [
          new Choice(true, $("For me")),
          new Choice(false, $("For someone else"))
        ],
        next: "state_resident"
      });
    });

    self.add("state_resident", function (name, opts) {
      return new ChoiceState(name, {
        question: $("Please confirm applicants residential status in SA."),
        error: $(
          [
            "Error. Choose one of the options below.",
            "",
            "Confirm the residential status in SA."
          ].join("\n")
        ),
        accept_labels: true,
        choices: [
          new Choice("sa_id", $("SA Citizen")),
          new Choice("resident", $("Permanent Resident")),
          new Choice("refugee", $("Refugee")),
          new Choice("other", $("Other"))
        ],
        next: function (choice) {
          if (choice.value === "other") {
            return "state_exit";
          } else {
            return "state_id_number";
          }
        }
      });
    });

    self.states.add("state_exit", function (name) {
      return new EndState(name, {
        next: "state_start",
        text: $(
          "Sorry. This service is only available to South African Citizens, " +
            "Permanent Residents or Refugees "
        )
      });
    });

    self.add("state_id_number", function (name, opts) {
      var question = "Please enter the applicants ID Number (eg 1234567890088)";
      var error_msg = [
        "Sorry, that is not a valid ID Number.",
        "",
        "Please enter the ID Number (eg 1234567890088)",
        "",
        "If you cannot provide the ID number, please type NO"
      ].join("\n");

      if (self.im.user.answers.state_resident === "refugee") {
        question =
          "Please enter the applicants Refugee Permit Number (e.g. 1234567890268)";
        error_msg = [
          "Sorry, that is not a valid Refugee Permit number.",
          "",
          "Please enter your Refugee Permit Number (eg 1234567890268)",
          "",
          "If you cannot provide it, please type NO"
        ].join("\n");
      }

      return new FreeText(name, {
        question: $(question),
        check: function (content) {
          if (_.upperCase(content) != "NO") {
            var match = content.match(/^(\d{6})(\d{4})(0|1)8\d$/);
            var today = new moment(self.im.config.testing_today).startOf("day"),
              dob;
            var validLuhn = function (content) {
              return (
                content
                  .split("")
                  .reverse()
                  .reduce(function (sum, digit, i) {
                    return (
                      sum +
                      _.parseInt(
                        i % 2 ? [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][digit] : digit
                      )
                    );
                  }, 0) %
                  10 ==
                0
              );
            };
            if (
              !match ||
              !validLuhn(content) ||
              !(dob = new moment(match[1], "YYMMDD")) ||
              !dob.isValid() ||
              !dob.isBetween(
                today.clone().add(-130, "years"),
                today.clone().add(-17, "years")
              )
            ) {
              return $(error_msg);
            } else {
              return new JsonApi(self.im)
                .post(
                  self.im.config.sassa_api.url + "/api/v1/check_id_number",
                  {
                    data: {
                      id_number: content
                    },
                    headers: {
                      Authorization: [
                        "Token " + self.im.config.sassa_api.token
                      ],
                      "User-Agent": ["Jsbox/SASSA-Registration-USSD"]
                    }
                  }
                )
                .then(function (response) {
                  if (!response.data.valid || response.data.underage) {
                    return $(error_msg);
                  } else if (response.data.existing) {
                    return $(
                      [
                        "An application for {{ id_number }} has already been made. The status is: {{ status }}.",
                        "To appeal, call 0800 002 9999"
                      ].join("\n")
                    ).context({
                      id_number: content,
                      status: response.data.status
                    });
                  }
                });
            }
          }
        },
        next: function (choice) {
          if (_.upperCase(choice) != "NO") {
            return "state_grant";
          } else {
            return "state_no_id";
          }
        }
      });
    });

    self.states.add("state_no_id", function (name) {
      return new EndState(name, {
        next: "state_start",
        text: $("Please call 080 002 9999.")
      });
    });

    self.add("state_grant", function (name) {
      return new ChoiceState(name, {
        question: $(
          "Do you (or the applicant) receive a child grant or social grant from SASSA?"
        ),
        error: $(
          [
            "Sorry, I don't understand that answer. Please choose one of the options below.",
            "Do you receive a child grant or social grant from SASSA?"
          ].join("\n")
        ),
        accept_labels: true,
        choices: [new Choice(true, $("Yes")), new Choice(false, $("No"))],
        next: "state_uif"
      });
    });

    self.add("state_uif", function (name) {
      return new ChoiceState(name, {
        question: $(
          "Do you (or the applicant) receive, or have you applied for, " +
            "Unemployment Insurance Fund (UIF) benefits?"
        ),
        error: $(
          [
            "Sorry, I don't understand that answer. Please choose one of the options below.",
            "",
            "Do you receive, or have you applied for UIF benefits?"
          ].join("\n")
        ),
        accept_labels: true,
        choices: [new Choice(true, $("Yes")), new Choice(false, $("No"))],
        next: "state_income"
      });
    });

    self.add("state_income", function (name) {
      return new ChoiceState(name, {
        question: $(
          "Do you (or the applicant) currently receive any income from any " +
            "other source – salary, wages, private or civil pension or annuity?"
        ),
        error: $(
          "Do you currently receive any income from any other source – salary, " +
            "wages, private or civil pension or annuity?"
        ),
        accept_labels: true,
        choices: [new Choice(true, $("Yes")), new Choice(false, $("No"))],
        next: "state_name"
      });
    });

    self.add("state_name", function (name) {
      return new FreeText(name, {
        question: $(
          "Please enter the applicant's name and surname as per identity " +
            "document (eg John Doe)"
        ),
        check: function (content) {
          var name = content.trim();
          if (name.length < 2 || name.length > 26 || name.indexOf(" ") == -1) {
            return $(
              [
                "Sorry, not a valid name. This answer can only contain full names and surnames.",
                "",
                "Please enter the name and surname  as per the identity document (eg John Doe)"
              ].join("\n")
            );
          }
        },
        next: "state_province"
      });
    });

    self.add("state_province", function (name) {
      return new ChoiceState(name, {
        question: $(["Please select Province", "", "Reply:"].join("\n")),
        error: $(["Please select Province", "", "Reply:"].join("\n")),
        accept_labels: true,
        choices: [
          new Choice("ZA-WC", $("WESTERN CAPE")),
          new Choice("ZA-EC", $("EASTERN CAPE")),
          new Choice("ZA-NC", $("NORTHERN CAPE")),
          new Choice("ZA-FS", $("FREE STATE")),
          new Choice("ZA-NL", $("KWAZULU NATAL")),
          new Choice("ZA-NW", $("NORTH WEST")),
          new Choice("ZA-GT", $("GAUTENG")),
          new Choice("ZA-MP", $("MPUMALANGA")),
          new Choice("ZA-LP", $("LIMPOPO"))
        ],
        next: "state_suburb"
      });
    });

    self.add("state_suburb", function (name) {
      return new FreeText(name, {
        question: $(
          "Please TYPE the name of the applicant's Suburb, Township, " +
            "Town or Village (or nearest)"
        ),
        check: function (content) {
          var match = content.match(/[a-zA-Z]{2,}/);
          if (!match) {
            return $(
              "Sorry, we don't understand. Please TYPE the name of the applicant's Suburb, Township, " +
                "Town or Village (or nearest)"
            );
          }
        },
        next: "state_street"
      });
    });

    self.add("state_street", function (name) {
      return new FreeText(name, {
        question: $("Please TYPE the Street Name and Number"),
        check: function (content) {
          var street = content.trim();
          if (
            street.length < 2 ||
            street.length > 95 ||
            street.indexOf(" ") == -1
          ) {
            return $(
              "Sorry, we don't understand. Please TYPE the Street Name and " +
                "Number"
            );
          }
        },
        next: "state_confirm_phonenumber"
      });
    });

    self.add("state_confirm_phonenumber", function (name) {
      var msisdn = utils.normalize_msisdn(self.im.user.addr, "ZA");
      self.im.user.set_answer("msisdn", self.im.user.addr);
      return new MenuState(name, {
        question: $(
          "We have detected this number ({{ msisdn }}). " +
            "Is this where we can contact you and the number we can send " +
            "the digital voucher to if you qualify?"
        ).context({ msisdn: msisdn }),
        error: $(
          [
            "Sorry, I don't understand that answer. Please choose one of the options below.",
            "Is ({{ msisdn }}) where we can contact you?"
          ].join("\n")
        ).context({ msisdn: msisdn }),
        accept_labels: true,
        choices: [
          new Choice("state_approval", $("Yes")),
          new Choice("state_enter_phonenumber", $("No"))
        ]
      });
    });

    self.add("state_enter_phonenumber", function (name) {
      return new FreeText(name, {
        question: $(
          "Please enter the cell phone number where we can reach you (or the " +
            "applicant) and that we can send the digital voucher to if you qualify."
        ),
        check: function (content) {
          if (!utils.is_valid_msisdn(content, "ZA")) {
            return $(
              [
                "Sorry, that is not a valid phone number. ",
                "Please enter the number in the format: 0801234567 or +27801234567",
                "We should be able to contect you on this number."
              ].join("\n")
            );
          }
          self.im.user.set_answer("msisdn", content);
        },
        next: "state_approval"
      });
    });

    self.add("state_approval", function (name) {
      var msisdn = utils.normalize_msisdn(self.im.user.answers.msisdn, "ZA");
      var id_number = self.im.user.answers.state_id_number;
      var username = self.im.user.answers.state_name;
      return new MenuState(name, {
        question: $(
          [
            "Thank you, is all this correct:",
            "",
            "Name: {{ name }}",
            "ID: {{ id_number }}",
            "Phone number: {{ msisdn }}"
          ].join("\n")
        ).context({ msisdn: msisdn, id_number: id_number, name: username }),
        error: $(
          [
            "Error: Please choose one of the options below.",
            "",
            "Is all this correct:",
            "",
            "Name: {{ name }}",
            "ID: {{ id_number }}",
            "Phone number: {{ msisdn }}"
          ].join("\n")
        ).context({ msisdn: msisdn, id_number: id_number, name: username }),
        accept_labels: true,
        choices: [
          new Choice("state_submit_data", $("Yes")),
          new Choice("state_restart", $("No"))
        ]
      });
    });

    self.add("state_restart", function (name) {
      return new ChoiceState(name, {
        question: $(
          "It is important that we have all the correct information for " +
            "you. You will need to complete the questions again to so that " +
            "we have the correct information."
        ),
        error: $(
          "It is important that we have all the correct information for " +
            "you. You will need to complete the questions again to so that " +
            "we have the correct information."
        ),
        accept_labels: true,
        choices: [new Choice("1", $("Continue"))],
        next: "state_start"
      });
    });

    self.add("state_submit_data", function (name, opts) {
      var device_msisdn = utils.normalize_msisdn(self.im.user.addr, "ZA");
      var msisdn = utils.normalize_msisdn(self.im.user.answers.msisdn, "ZA");
      var address = [
        self.im.user.answers.state_street,
        self.im.user.answers.state_suburb
      ].join(", ");
      var id_number = null;
      if (_.upperCase(self.im.user.answers.state_id_number) != "NO") {
        id_number = self.im.user.answers.state_id_number;
      }

      return new JsonApi(self.im)
        .post(self.im.config.sassa_api.url + "/api/v1/registrations/", {
          data: {
            id_type: self.im.user.answers.state_resident,
            id_number: id_number,
            uif: self.im.user.answers.state_uif,
            income: self.im.user.answers.state_income,
            grant: self.im.user.answers.state_grant,
            name: self.im.user.answers.state_name,
            address: address,
            phonenumber: msisdn,
            self_registration: self.im.user.answers.state_start,
            device_msisdn: device_msisdn,
            province: self.im.user.answers.state_province
          },
          headers: {
            Authorization: ["Token " + self.im.config.sassa_api.token],
            "User-Agent": ["Jsbox/SASSA-Registration-USSD"]
          }
        })
        .then(
          function () {
            return self.states.create("state_update_complete");
          },
          function (e) {
            // Go to error state after 3 failed HTTP requests
            opts.http_error_count = _.get(opts, "http_error_count", 0) + 1;
            if (opts.http_error_count === 3) {
              self.im.log.error(e.message);
              return self.states.create("__error__", { return_state: name });
            }
            return self.states.create(name, opts);
          }
        );
    });

    self.states.add("state_update_complete", function (name) {
      return new EndState(name, {
        next: "state_start",
        text: $(
          [
            "Thank you! Your application has been sent to our system for approval. You will receive a response within 48 hours.",
            "",
            "If you have problems call 080 002 9999."
          ].join("\n")
        )
      });
    });

    self.states.creators.__error__ = function (name, opts) {
      var return_state = opts.return_state || "state_start";
      return new EndState(name, {
        next: return_state,
        text: $(
          "Sorry, something went wrong. We have been notified. Please try again later"
        )
      });
    };
  });

  return {
    GoApp: GoApp
  };
})();
