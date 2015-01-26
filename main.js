/*********************************************************************************************
 *
 *      Team: Josh Sackos, Mark Davis, Jacob Wolf, Brian Lancaster, Monique Tucker
 *     Event: Intel IoT Hackathon - Transportation - PDX
 *   Project: Smart IoT Stroller
 *      Date: 12/05/2014 - 12/07/2014
 *
 * Description:
 *
 *              Code for baby stroller that automatically locks wheels when parent lets go
 *              of handlebar. The Smart Stroller also has LEDs for left turn, right turn, and
 *              and brake signals. All Smart Stroller events are logged to the cloud.
 *              
 *              Every 500ms four capacitive touch sensor states are sampled. Two of the
 *              touch sensors are used for detecting when a parent lets go of the baby
 *              stroller handlebar, and the other two are used to indicate the parent's
 *              intent to turn left, right, or brake.
 *
 *              If the parent is touching either the left_touch_sensor or right_touch_sensor
 *              then a solenoid acting as a brake is retracted (pull type solenoid). When
 *              the parent is not touching either touch sensor the brake is applied (no power).
 *
 *              When the parent is touching only the left turn signal touch sensor, the left
 *              LED strip begins toggling every half a second (500ms). Similarly, when the
 *              parent is touching only the right turn signal touch sensor the right LED
 *              strip begins toggling every half a second. When the parent is touching both
 *              turn signals, both LED strips illuminate and do not toggle.
 *
 *
 ********************************************************************************************/

var mraa = require('mraa');    //require mraa
var req = require('request');  //require request

console.log('MRAA Version: ' + mraa.getVersion()); //write the mraa version to the console

// ----------------------------
//         Global Vars
// ----------------------------

    var CLOUD_STORAGE_URL = 'https://my.website.com/rest/of/path/here';

    // Setup general purpose input/output pins
    var left_touch_sensor_pin = new mraa.Gpio(7);  // Signal from left touch sensor, used for controlling solenoid/brake
    var right_touch_sensor_pin = new mraa.Gpio(6); // Signal from right touch sensor, used for controlling solenoid/brake
    var left_turn_sensor_pin = new mraa.Gpio(8);   // Signal from left turn signal touch sensor, used for controlling left turn signal LED strip
    var right_turn_sensor_pin = new mraa.Gpio(5);  // Signal from right turn signal touch sensor, used for controlling right turn signal LED strip
    var left_turn_led_pin = new mraa.Gpio(3);      // Control pin for left LED strip
    var right_turn_led_pin = new mraa.Gpio(4);     // Control pin for right LED strip
    var solenoid_pin = new mraa.Gpio(2);           // Control pin for solenoid/brake

// ---------------------------------------------------------------
//                     Application Entry Point
// ---------------------------------------------------------------

    setupIO();  // Setup pin directions and initial states

    // ----- Containers for current and previous sensor values and outputs ------
    var left_touch_sensor_value = 0;
    var right_touch_sensor_value = 0;
    var left_turn_sensor_value = 0;
    var right_turn_sensor_value = 0;
    
    var prev_left_touch_sensor_value = 0;
    var prev_right_touch_sensor_value = 0;
    var prev_left_turn_sensor_value = 0;
    var prev_right_turn_sensor_value = 0;
    
    var left_turn_led_value = 0;
    var right_turn_led_value = 0;
    var solenoid_value = 0;

    var prev_left_turn_led_value = 0;
    var prev_right_turn_led_value = 0;
    var prev_solenoid_value = 0;

/*******************************************************************************
 *           Function: function ()
 *       Date Created: 12/06/2014
 *        Description: This function is called every 500ms and will therefore
 *                     execute indefinitely until the program is terminated.
 *                     This function can be thought of as loop() in Arduino,
 *                     however, the loop will only execute once every 500ms
 *                     instead of continuously like in Arduino.
 *                     
 *   Input parameters: None
 *
 *            Returns: None
/******************************************************************************/
    setInterval(function () {

        // Store previous sensor values
        prev_left_touch_sensor_value = left_touch_sensor_value;
        prev_right_touch_sensor_value = right_touch_sensor_value;
        prev_left_turn_sensor_value = left_turn_sensor_value;
        prev_right_turn_sensor_value = right_turn_sensor_value;
    
        // Read sensor data
        left_touch_sensor_value = left_touch_sensor_pin.read();
        right_touch_sensor_value = right_touch_sensor_pin.read();
        left_turn_sensor_value = left_turn_sensor_pin.read();
        right_turn_sensor_value = right_turn_sensor_pin.read();

        // Save previous solenoid and LED values
        prev_left_turn_led_value = left_turn_led_value;
        prev_right_turn_led_value = right_turn_led_value;
        prev_solenoid_value = solenoid_value;

        
        // ---- If any of the sensor values changed then log in the cloud ----
        if(prev_left_touch_sensor_value != left_touch_sensor_value)
        {
            save_to_cloud('left_touch_sensor', left_touch_sensor_value);
        }
        if(prev_right_touch_sensor_value != right_touch_sensor_value)
        {
            save_to_cloud('right_touch_sensor', right_touch_sensor_value);
        }
        if(prev_left_turn_sensor_value != left_turn_sensor_value)
        {
            save_to_cloud('left_turn_sensor', left_turn_sensor_value);
        }
        if(prev_right_turn_sensor_value != right_turn_sensor_value)
        {
            save_to_cloud('right_turn_sensor', right_turn_sensor_value);
        }
        
        // ----------- Process touch sensors ------------------
        if(left_touch_sensor_value || right_touch_sensor_value)
        {
            // Retract brake
            solenoid_value = 1;
        }
        else
        {
            // Extend brake
            solenoid_value = 0;
        }
        solenoid_pin.write(solenoid_value);         // Update solenoid output value
        
        // If the solenoid output value changed log it in the cloud
        if(prev_solenoid_value != solenoid_value)
        {
            save_to_cloud('brake',solenoid_value);
        }
        
        
        // ----------- Process turn signal sensors ------------------
        if(left_turn_sensor_value && right_turn_sensor_value)
        {
            // Brake
            left_turn_led_value = 1;
            right_turn_led_value = 1;
        }
        else if(left_turn_sensor_value && !right_turn_sensor_value)
        {
            // Left turn signal
            left_turn_led_value = ~left_turn_led_value;
            right_turn_led_value = 0;
        }
        else if(!left_turn_sensor_value && right_turn_sensor_value)
        {
            // Right turn signal
            left_turn_led_value = 0;
            right_turn_led_value = ~right_turn_led_value;
        }
        else
        {
            // Turn off both signals
            left_turn_led_value = 0;
            right_turn_led_value = 0;
        }
        left_turn_led_pin.write(left_turn_led_value);       // Update left turn output value
        right_turn_led_pin.write(right_turn_led_value);     // Update right turn output value

        // If the left turn LED output value has changed log it in the cloud
        if(prev_left_turn_led_value != left_turn_led_value)
        {
            save_to_cloud('left',left_turn_led_value);
        }
        // If the right turn LED output value has changed log it in the cloud
        if(prev_right_turn_led_value != right_turn_led_value)
        {
            save_to_cloud('right',right_turn_led_value);
        }
        
    }, 500);

/*******************************************************************************
 *           Function: setupIO()
 *       Date Created: 12/06/2014
 *        Description: Sets direction of pins used in design and sets initial
 *                     values of output pins.
 *                     
 *   Input parameters: None
 *
 *            Returns: None
/******************************************************************************/
function setupIO()
{
    left_touch_sensor_pin.dir(mraa.DIR_IN);
    right_touch_sensor_pin.dir(mraa.DIR_IN);
    left_turn_sensor_pin.dir(mraa.DIR_IN);
    right_turn_sensor_pin.dir(mraa.DIR_IN);
    
    left_turn_led_pin.dir(mraa.DIR_OUT);
    right_turn_led_pin.dir(mraa.DIR_OUT);
    solenoid_pin.dir(mraa.DIR_OUT);
    
    // Initial values
    solenoid_pin.write(0);
    left_turn_led_pin.write(0);
    right_turn_led_pin.write(0);
}

/*******************************************************************************
 *           Function: save_to_cloud()
 *       Date Created: 12/06/2014
 *        Description: Posts arguments to defined cloud storage URL as JSON
 *                     object.
 *                     
 *   Input parameters: itemtype_arg   -> Identifies what data represents
 *                     text_arg       -> Data value
 *
 *            Returns: None
/******************************************************************************/
function save_to_cloud(itemtype_arg, text_arg)
{    
    console.log('Data: ' + text_arg);
   
    req.post(CLOUD_STORAGE_URL,
       { json: { itemtype : itemtype_arg, text:text_arg } },
       function (error, response, body) {
           console.log(body)
           if (!error && response.statusCode == 200) {
               console.log(body)
           }
       }
    );

   console.log('posted!');
}
