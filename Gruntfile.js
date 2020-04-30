module.exports = function (grunt) {
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-prettier");
  grunt.loadNpmTasks("grunt-mocha-test");

  grunt.initConfig({
    paths: {
      src: {
        ussd: ["src/index.js", "src/ussd_sassa_registration.js", "src/init.js"],
        whatsapp: [
          "src/index.js",
          "src/whatsapp_sassa_registration.js",
          "src/init.js"
        ]
      },
      test: {
        ussd: [
          "test/setup.js",
          "src/ussd_sassa_registration.js",
          "test/ussd_sassa_registration.test.js"
        ],
        whatsapp: [
          "test/setup.js",
          "src/whatsapp_sassa_registration.js",
          "test/whatsapp_sassa_registration.test.js"
        ]
      },
      all: ["Gruntfile.js", "src/**/*.js", "test/**/*.js"]
    },
    jshint: {
      options: { jshintrc: ".jshintrc" },
      all: ["<%= paths.all %>"]
    },
    prettier: {
      files: {
        src: ["<%= paths.all %>"]
      },
      "go-app-ussd_sassa_registration.js": ["<%= paths.src.ussd %>"],
      "go-app-whatsapp_sassa_registration.js": ["<%= paths.src.whatsapp %>"]
    },
    mochaTest: {
      options: {
        reporter: "spec"
      },
      test_ussd: {
        src: ["<%= paths.test.ussd %>"]
      },
      test_whatsapp: {
        src: ["<%= paths.test.whatsapp %>"]
      }
    }
  });

  grunt.registerTask("test", ["prettier", "jshint", "mochaTest"]);
};
