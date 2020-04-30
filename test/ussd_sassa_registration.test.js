var vumigo = require("vumigo_v02");
var AppTester = vumigo.AppTester;

describe("ussd_sassa_registration app", function () {
  var app;
  var tester;

  beforeEach(function () {
    app = new go.app.GoApp();
    tester = new AppTester(app);
    tester.setup.config.app({
      sassa_api: {
        url: "http://sassa",
        token: "testtoken"
      }
    });
  });
  describe("state_timed_out", function () {
    it("should ask the user if they want to continue", function () {
      return tester.setup.user
        .state("state_resident")
        .start()
        .check.interaction({
          state: "state_timed_out",
          reply: [
            "Welcome back. Do you want to:",
            "1. Continue where you left off",
            "2. Start again"
          ].join("\n"),
          char_limit: 140
        })
        .run();
    });
    it("should repeat question on invalid input", function () {
      return tester.setup.user
        .state("state_resident")
        .inputs({ session_event: "new" }, "A")
        .check.interaction({
          state: "state_timed_out",
          reply: [
            "Welcome back. Do you want to:",
            "1. Continue where you left off",
            "2. Start again"
          ].join("\n"),
          char_limit: 140
        })
        .run();
    });
  });
  describe("state_start", function () {
    it("should ask who the application is for", function () {
      return tester
        .start()
        .check.interaction({
          state: "state_start",
          reply: [
            "Welcome. SASSA is offering food grants to those who qualify.",
            "Is this application for your or someone else?",
            "1. For me",
            "2. For someone else"
          ].join("\n"),
          char_limit: 140
        })
        .run();
    });
    it("should display error on invalid input", function () {
      return tester
        .input("A")
        .check.interaction({
          state: "state_start",
          reply: [
            "Please use the numbers to choose one of the options below.",
            "",
            "Is this application for your or someone else?",
            "1. For me",
            "2. For someone else"
          ].join("\n"),
          char_limit: 140
        })
        .run();
    });
    it("should go to state_resident", function () {
      return tester.input("2").check.user.state("state_resident").run();
    });
  });
  describe("state_resident", function () {
    it("should ask the applicants residency status", function () {
      return tester.setup.user
        .state("state_resident")
        .check.interaction({
          state: "state_resident",
          reply: [
            "Please confirm applicants residential status in SA.",
            "1. SA Citizen",
            "2. Permanent Resident",
            "3. Refugee",
            "4. Other"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should ask again for invalid inout", function () {
      return tester.setup.user
        .state("state_resident")
        .input("A")
        .check.interaction({
          state: "state_resident",
          reply: [
            "Error. Choose one of the options below.",
            "",
            "Confirm the residential status in SA.",
            "1. SA Citizen",
            "2. Permanent Resident",
            "3. Refugee",
            "4. Other"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_id_number", function () {
      return tester.setup.user
        .state("state_resident")
        .input("2")
        .check.user.state("state_id_number")
        .run();
    });
    it("should go to state_exit for other", function () {
      return tester.setup.user
        .state("state_resident")
        .input("4")
        .check.user.state("state_exit")
        .run();
    });
  });
  describe("state_id_number", function () {
    it("should ask the applicants id number for resident", function () {
      return tester.setup.user
        .state("state_id_number")
        .setup.user.answers({ state_resident: "sa_id" })
        .check.interaction({
          state: "state_id_number",
          reply: "Please enter the applicants ID Number (eg 1234567890088)",
          char_limit: 160
        })
        .run();
    });
    it("should ask the applicants id number for Refugee", function () {
      return tester.setup.user
        .state("state_id_number")
        .setup.user.answers({ state_resident: "refugee" })
        .check.interaction({
          state: "state_id_number",
          reply:
            "Please enter the applicants Refugee Permit Number (e.g. 1234567890268)",
          char_limit: 160
        })
        .run();
    });
    it("should ask the applicants id number for resident again on invalid input", function () {
      return tester.setup.user
        .state("state_id_number")
        .setup.user.answers({ state_resident: "sa_id" })
        .input("A")
        .check.interaction({
          state: "state_id_number",
          reply: [
            "Sorry, that is not a valid ID Number.",
            "",
            "Please enter the ID Number (eg 1234567890088)",
            "",
            "If you cannot provide the ID number, please type NO"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should ask the applicants id number for refugee again on invalid input", function () {
      return tester.setup.user
        .state("state_id_number")
        .setup.user.answers({ state_resident: "refugee" })
        .input("A")
        .check.interaction({
          state: "state_id_number",
          reply: [
            "Sorry, that is not a valid Refugee Permit number.",
            "",
            "Please enter your Refugee Permit Number (eg 1234567890268)",
            "",
            "If you cannot provide it, please type NO"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_grant for NO", function () {
      return tester.setup.user
        .state("state_id_number")
        .input("No")
        .check.user.state("state_no_id")
        .run();
    });
    it("should check id number and go to state_grant if valid", function () {
      return tester.setup.user
        .state("state_id_number")
        .setup(function (api) {
          api.http.fixtures.add({
            request: {
              url: "http://sassa/api/v1/check_id_number",
              method: "POST",
              data: {
                id_number: "7401106750188"
              }
            },
            response: {
              code: 200,
              data: {
                valid: true,
                existing: false,
                underage: false
              }
            }
          });
        })
        .input("7401106750188")
        .check.user.state("state_grant")
        .run();
    });
    it("should check id number and message if invalid", function () {
      return tester.setup.user
        .state("state_id_number")
        .setup.user.answers({ state_resident: "refugee" })
        .setup(function (api) {
          api.http.fixtures.add({
            request: {
              url: "http://sassa/api/v1/check_id_number",
              method: "POST",
              data: {
                id_number: "7401106750188"
              }
            },
            response: {
              code: 200,
              data: {
                valid: false,
                existing: false,
                underage: false
              }
            }
          });
        })
        .input("7401106750188")
        .check.interaction({
          state: "state_id_number",
          reply: [
            "Sorry, that is not a valid Refugee Permit number.",
            "",
            "Please enter your Refugee Permit Number (eg 1234567890268)",
            "",
            "If you cannot provide it, please type NO"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should check id number and message if existing", function () {
      return tester.setup.user
        .state("state_id_number")
        .setup.user.answers({ state_resident: "refugee" })
        .setup(function (api) {
          api.http.fixtures.add({
            request: {
              url: "http://sassa/api/v1/check_id_number",
              method: "POST",
              data: {
                id_number: "7401106750188"
              }
            },
            response: {
              code: 200,
              data: {
                valid: true,
                existing: true,
                underage: false,
                status: "Pending"
              }
            }
          });
        })
        .input("7401106750188")
        .check.interaction({
          state: "state_id_number",
          reply: [
            "An application for 7401106750188 has already been made. The status is: Pending.",
            "To appeal, call 0800 002 9999"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
  });
  describe("state_grant", function () {
    it("should ask if the applicant has a existing grant", function () {
      return tester.setup.user
        .state("state_grant")
        .check.interaction({
          state: "state_grant",
          reply: [
            "Do you (or the applicant) receive a child grant or social grant from SASSA?",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should display an error on invalid input", function () {
      return tester.setup.user
        .state("state_grant")
        .input("A")
        .check.interaction({
          state: "state_grant",
          reply: [
            "Sorry, I don't understand that answer. Please choose one of the options below.",
            "Do you receive a child grant or social grant from SASSA?",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_uif", function () {
      return tester.setup.user
        .state("state_grant")
        .input("2")
        .check.user.state("state_uif")
        .run();
    });
  });
  describe("state_uif", function () {
    it("should ask if the applicant has UIF", function () {
      return tester.setup.user
        .state("state_uif")
        .check.interaction({
          state: "state_uif",
          reply: [
            "Do you (or the applicant) receive, or have you applied for, Unemployment Insurance Fund (UIF) benefits?",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should display an error on invalid input", function () {
      return tester.setup.user
        .state("state_uif")
        .input("A")
        .check.interaction({
          state: "state_uif",
          reply: [
            "Sorry, I don't understand that answer. Please choose one of the options below.",
            "",
            "Do you receive, or have you applied for UIF benefits?",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_income", function () {
      return tester.setup.user
        .state("state_uif")
        .input("2")
        .check.user.state("state_income")
        .run();
    });
  });
  describe("state_income", function () {
    it("should ask if the applicant has a income", function () {
      return tester.setup.user
        .state("state_income")
        .check.interaction({
          state: "state_income",
          reply: [
            "Do you (or the applicant) currently receive any income from any other source – salary, wages, private or civil pension or annuity?",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should ask again on invalid input", function () {
      return tester.setup.user
        .state("state_income")
        .input("A")
        .check.interaction({
          state: "state_income",
          reply: [
            "Do you currently receive any income from any other source – salary, wages, private or civil pension or annuity?",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_name", function () {
      return tester.setup.user
        .state("state_income")
        .input("1")
        .check.user.state("state_name")
        .run();
    });
  });
  describe("state_name", function () {
    it("should ask for the name", function () {
      return tester.setup.user
        .state("state_name")
        .check.interaction({
          state: "state_name",
          reply:
            "Please enter the applicant's name and surname as per identity " +
            "document (eg John Doe)",
          char_limit: 160
        })
        .run();
    });
    it("should display error for invalid", function () {
      return tester.setup.user
        .state("state_name")
        .input("a")
        .check.interaction({
          state: "state_name",
          reply: [
            "Sorry, not a valid name. This answer can only contain full names and surnames.",
            "",
            "Please enter the name and surname  as per the identity document (eg John Doe)"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_province", function () {
      return tester.setup.user
        .state("state_name")
        .input("John Doe")
        .check.user.state("state_province")
        .run();
    });
  });
  describe("state_province", function () {
    it("should ask the applicants province", function () {
      return tester.setup.user
        .state("state_province")
        .check.interaction({
          state: "state_province",
          reply: [
            "Please select Province",
            "",
            "Reply:",
            "1. WESTERN CAPE",
            "2. EASTERN CAPE",
            "3. NORTHERN CAPE",
            "4. FREE STATE",
            "5. KWAZULU NATAL",
            "6. NORTH WEST",
            "7. GAUTENG",
            "8. MPUMALANGA",
            "9. LIMPOPO"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should ask again on invalid input", function () {
      return tester.setup.user
        .state("state_province")
        .input("A")
        .check.interaction({
          state: "state_province",
          reply: [
            "Please select Province",
            "",
            "Reply:",
            "1. WESTERN CAPE",
            "2. EASTERN CAPE",
            "3. NORTHERN CAPE",
            "4. FREE STATE",
            "5. KWAZULU NATAL",
            "6. NORTH WEST",
            "7. GAUTENG",
            "8. MPUMALANGA",
            "9. LIMPOPO"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_suburb", function () {
      return tester.setup.user
        .state("state_province")
        .input("1")
        .check.user.state("state_suburb")
        .run();
    });
  });
  describe("state_suburb", function () {
    it("should ask for the suburb", function () {
      return tester.setup.user
        .state("state_suburb")
        .check.interaction({
          state: "state_suburb",
          reply:
            "Please TYPE the name of the applicant's Suburb, Township, " +
            "Town or Village (or nearest)",
          char_limit: 160
        })
        .run();
    });
    it("should display error for invalid", function () {
      return tester.setup.user
        .state("state_suburb")
        .input("a")
        .check.interaction({
          state: "state_suburb",
          reply:
            "Sorry, we don't understand. Please TYPE the name of the applicant's Suburb, Township, " +
            "Town or Village (or nearest)",
          char_limit: 160
        })
        .run();
    });
    it("should go to state_street", function () {
      return tester.setup.user
        .state("state_suburb")
        .input("fake city")
        .check.user.state("state_street")
        .run();
    });
  });
  describe("state_street", function () {
    it("should ask for the street", function () {
      return tester.setup.user
        .state("state_street")
        .check.interaction({
          state: "state_street",
          reply: "Please TYPE the Street Name and Number",
          char_limit: 160
        })
        .run();
    });
    it("should display error for invalid", function () {
      return tester.setup.user
        .state("state_street")
        .input("a")
        .check.interaction({
          state: "state_street",
          reply:
            "Sorry, we don't understand. Please TYPE the Street Name and " +
            "Number",
          char_limit: 160
        })
        .run();
    });
    it("should go to state_confirm_phonenumber", function () {
      return tester.setup.user
        .state("state_street")
        .input("123 fake street")
        .check.user.state("state_confirm_phonenumber")
        .run();
    });
  });
  describe("state_confirm_phonenumber", function () {
    it("should ask to confirm the phonenumber", function () {
      return tester.setup.user
        .state("state_confirm_phonenumber")
        .check.interaction({
          state: "state_confirm_phonenumber",
          reply: [
            "We have detected this number (+27123456789). " +
              "Is this where we can contact you and the number we can send " +
              "the digital voucher to if you qualify?",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should display error for invalid", function () {
      return tester.setup.user
        .state("state_confirm_phonenumber")
        .input("a")
        .check.interaction({
          state: "state_confirm_phonenumber",
          reply: [
            "Sorry, I don't understand that answer. Please choose one of the options below.",
            "Is (+27123456789) where we can contact you?",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_approval", function () {
      return tester.setup.user
        .state("state_confirm_phonenumber")
        .input("1")
        .check.user.state("state_approval")
        .run();
    });
  });
  describe("state_enter_phonenumber", function () {
    it("should ask to enter the phonenumber", function () {
      return tester.setup.user
        .state("state_enter_phonenumber")
        .check.interaction({
          state: "state_enter_phonenumber",
          reply:
            "Please enter the cell phone number where we can reach you (or the " +
            "applicant) and that we can send the digital voucher to if you qualify.",
          char_limit: 160
        })
        .run();
    });
    it("should display error for invalid", function () {
      return tester.setup.user
        .state("state_enter_phonenumber")
        .input("a")
        .check.interaction({
          state: "state_enter_phonenumber",
          reply: [
            "Sorry, that is not a valid phone number. ",
            "Please enter the number in the format: 0801234567 or +27801234567",
            "We should be able to contect you on this number."
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_approval", function () {
      return tester.setup.user
        .state("state_enter_phonenumber")
        .input("+27801234567")
        .check.user.state("state_approval")
        .run();
    });
  });
  describe("state_approval", function () {
    it("should ask to confirm details", function () {
      return tester.setup.user
        .state("state_approval")
        .setup.user.answers({
          state_id_number: "test-id-number",
          state_name: "John Doe",
          msisdn: "+27123456789"
        })
        .check.interaction({
          state: "state_approval",
          reply: [
            "Thank you, is all this correct:",
            "",
            "Name: John Doe",
            "ID: test-id-number",
            "Phone number: +27123456789",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should display error for invalid", function () {
      return tester.setup.user
        .state("state_approval")
        .setup.user.answers({
          state_id_number: "test-id-number",
          state_name: "John Doe",
          msisdn: "+27123456789"
        })
        .input("a")
        .check.interaction({
          state: "state_approval",
          reply: [
            "Error: Please choose one of the options below.",
            "",
            "Is all this correct:",
            "",
            "Name: John Doe",
            "ID: test-id-number",
            "Phone number: +27123456789",
            "1. Yes",
            "2. No"
          ].join("\n"),
          char_limit: 160
        })
        .run();
    });
    it("should go to state_restart if details are wrong", function () {
      return tester.setup.user
        .state("state_approval")
        .setup.user.answers({
          msisdn: "+27123456780"
        })
        .input("2")
        .check.user.state("state_restart")
        .run();
    });
    it("should submit details if they are correct", function () {
      return tester.setup.user
        .state("state_approval")
        .setup.user.answers({
          state_resident: "refugee",
          state_id_number: "No",
          state_uif: false,
          state_income: false,
          state_grant: false,
          state_name: "John Doe",
          state_start: false,
          state_street: "1 friend street",
          state_suburb: "woodstock",
          state_province: "ZA-WC",
          msisdn: "+27123456780"
        })
        .setup(function (api) {
          api.http.fixtures.add({
            request: {
              url: "http://sassa/api/v1/registrations/",
              method: "POST",
              data: {
                id_type: "refugee",
                id_number: null,
                uif: false,
                income: false,
                grant: false,
                name: "John Doe",
                address: "1 friend street, woodstock",
                province: "ZA-WC",
                phonenumber: "+27123456780",
                device_msisdn: "+27123456789",
                self_registration: false
              }
            },
            response: {
              code: 201,
              data: {}
            }
          });
        })
        .input("1")
        .check.interaction({
          state: "state_update_complete",
          reply: [
            "Thank you! Your application has been sent to our system for approval. You will receive a response within 48 hours.",
            "",
            "If you have problems call 080 002 9999."
          ].join("\n"),
          char_limit: 160
        })
        .check.reply.ends_session()
        .run();
    });
  });
});
