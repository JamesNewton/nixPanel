// *nix panel
// Android phone/tablet frontpanel for headless Linux devices via USB OTG
// Run in DroidScript which allows you to write apps in JavaScript:
// http://droidscript.org/
// https://play.google.com/store/apps/details?id=com.smartphoneremote.androidscriptfree
// by James Newton 2019/08/08
// http://techref.massmind.org/techref/index.html
// Note: this application only works on devices that support  
// OTG and allow access to external serial devices.
// 
// Known to work: iRola DX752, Nexus7, GalaxyS3/S4, ExperiaZUltra, TescoHudl,  
// Asus MemoPad 8, Amazon Fire 7 (must install Google Play Store)
// Known to work AND charge: iRola DX752
// Don't work: Nexus4, GalaxyS1, AsusMemo

//Global variables. 
var connectStr="\n"; //sent to device upon connection.
var usb=null, reply=""; 
var log="", maxLines;
var txts="", descs=[], cmds=[], ary;
var desc="";
var modes=" [ Going to sleep ";
var mode="";
var aryParm=[];

//Called when application is started. 
function OnStart() { 
    
    txts = app.LoadText("nixPanelCommands");
    if (!txts) { //load default values if none saved.
        txts = "[select commands]\t\r";
        txts +="Get IP Address\thostname -I\r";
        txts +="Set #IP\tsetip\r";
        txts +="Restart\t#\r";
        }

    ary = txts.split("\r");
    for (var i = 0; i<ary.length; i++) {
        txts = ary[i].split("\t"); //seperate description from command
        cmds[txts[0]]=txts[1]; //associate description with command
        descs[i]=txts[0]; //build ordered array of descriptions
        } 
    
    //Create a layout with objects vertically centered. 
    lay = app.CreateLayout( "linear", "VCenter,FillXY" );   

    //Create title text. 
    txt = app.CreateText("Stats: unknown"); 
    txt.SetTextSize( 22 ); 
    txt.SetMargins( 0,0,0,0.01 ); 
    lay.AddChild( txt );

    //Create a read-only edit box to show responses. 
    edtReply = app.CreateText( "", 0.96, 0.6, "MultiLine,Left,Monospace" ); 
    edtReply.SetMargins( 0,0,0,0.01 ); 
    edtReply.SetBackColor( "#333333" );
    edtReply.SetTextSize( 8 ); // must be 8 to fit pin status
// could be larger for most things. but changing size changes line count.
    lay.AddChild( edtReply ); 
    
    //Create an edit box containing the constructed commands
    edt = app.CreateTextEdit( "", 0.96, 0.2, "NoSpell" ); 
    edt.SetOnChange( edt_OnChange );
    lay.AddChild( edt ); 
    
    //Create program spinner.
    spin = app.CreateSpinner( descs.join(","), 0.8 );
    spin.SetOnTouch( spin_OnTouch );
    lay.AddChild( spin );
    
    //Create a horizontal layout for buttons. 
    layBut = app.CreateLayout("Linear", "Horizontal"); 
    lay.AddChild( layBut );

    //Create an connect button. 
    btnConnect = app.CreateButton( "Connect", 0.23, 0.1 ); 
    btnConnect.SetOnTouch( btnConnect_OnTouch ); 
    layBut.AddChild( btnConnect );

    //Create an send button. 
    btnSend = app.CreateButton( "Send", 0.23, 0.1 ); 
    btnSend.SetOnTouch( btnSend_OnTouch ); 
    layBut.AddChild( btnSend );

     //Create a reset button. 
    //btnReset = app.CreateButton( "Clear", 0.23, 0.1 ); 
    btnReset = makeImgButton(.23, .1, "Clear", 22)//app.CreateImage( null, 0.23, .1, "button" );
    //btnReset.SetTextSize( 24 , "dip");
    //btnReset.DrawText("Clear",btnReset.MeasureText("Clear").width/2, 0.6);
    btnReset.SetOnTouchUp( btnReset_OnTouch ); 
    btnReset.SetOnLongTouch( btnReset_OnLongTouch ); 
    layBut.AddChild( btnReset );

    //Create an save button. 
    btnSave = app.CreateButton( "Save", 0.23, 0.1 ); 
    btnSave.SetOnTouch( btnSave_OnTouch ); 
    //btnSave.SetOnLongTouch (btnSave_OnLongTouch);
    layBut.AddChild( btnSave);

    //Add layout to app.     
    app.AddLayout( lay );

    }
    
function makeImgButton(w, h, text, points) {
    let img = app.CreateImage( null, w, h, "button" );
    img.SetTextSize(points, "dip");
    let x = 0.5-img.MeasureText(text).width/2
    let y = 0.5-img.MeasureText(text).height/2
    img.DrawText(text,x,y);
    return img
}

//Called when user touches connect button. 
function btnConnect_OnTouch() 
{ 
    //Create USB serial object. 
    usb = app.CreateUSBSerial(); 
    if( !usb ) 
    {
        app.ShowPopup( "Please connect a compatible USB device" );
        return;
    }
    usb.SetOnReceive( usb_OnReceive );
    Send (connectStr); //stimulate a response.
    app.ShowPopup( "Connected" );
}

//Called when user touches send button. 
function btnSend_OnTouch() {  
    var s = edt.GetText(); 
    //Get rid of blank lines, spaces etc (unnecessary?)
    //s = s.replace( RegExp("\n\n+","gim"), "\n" ); 
    //s = s.replace( RegExp("\n +","gim"), "\n" ); 
    //s = s.replace( RegExp("\\)\\s*\\{","gim"), "\)\{" ); 
    //s = s.replace( RegExp(", +","gim"), "," ); 
    //s = s.replace( RegExp("\\( +","gim"), "\(" ); 
    //s = s.replace( RegExp(" +\\)","gim"), "\)" ); 
    edt.SetText(s);
    Send( s ); 
    }

//Called when user touches clear button. 
function btnReset_OnTouch() { 
    edt.SetText( "" ); //clear text edit.
    spin.SelectItem(descs[0]); //clear pull down so next selection works
    }

function btnReset_OnLongTouch() {
    app.SaveText("nixPanelCommands",""); //clear the previously stored data
    }    
    
//Called when user touches save button. 
function btnSave_OnTouch(item) { 
    //need to ask the user for a description for the current command
    //Create dialog window.
    dlgTxt = app.CreateDialog( "Name?" );
    
    //Create a layout for dialog.
    layDlg = app.CreateLayout( "linear", "VCenter,FillXY" );
    layDlg.SetPadding( 0.02, 0, 0.02, 0.02 );
    dlgTxt.AddLayout( layDlg );

    //Create an text edit box.
    edtDesc = app.CreateTextEdit( "Do: "+edt.GetText(), 0.8, 0.1 );
    edtDesc.SetMargins( 0, 0.02, 0, 0 );
    edtDesc.SetSelection(0, edtDesc.GetText().length);
    layDlg.AddChild( edtDesc );

    //Create an ok button. 
    btnOk = app.CreateButton( "Ok", 0.23, 0.1 ); 
    btnOk.SetOnTouch( btnOk_OnTouch ); 
    layDlg.AddChild( btnOk ); 
    
    //Show dialog.
    dlgTxt.Show();
    }

//called when user closes save name dialog
function btnOk_OnTouch(item) {
    var txts="";
    desc = edtDesc.GetText();
    descs.push(desc); //add new description to array
    spin.SetList(descs.join(",")); //and to the displayed list
    cmds[desc]=edt.GetText(); //associate command with description
    for (var i=0; i<descs.length; i++) { //build a file to save list
        txts += descs[i]+"\t"+cmds[descs[i]]+"\r";
        }
    //uncomment next line to actually save them. Disabled during development.
    //app.SaveText("nixPanelCommands",txts); //and store it.
    dlgTxt.Hide();
    app.ShowPopup("Saved "+desc);
    }

function btnSave_OnLongTouch() {
    app.SaveText("nixPanelCommands",txts); //save command list
    } 

//Called when text entered directly in edit area
function edt_OnChange() {
    if ("\n"==edt.GetText().slice(-1)) { //if they just pressed return
        edt.SetText( edt.GetText().slice(0,-1) ); //remove the return.
        btnSend_OnTouch(); //pretend the user pressed send
        edt.SetCursorPos( edt.GetText().length ); //move cursor to end
        }
    }

//Called when user touches program spinner.
//http://dangerousprototypes.com/docs/Bus_Pirate_menu_options_guide
function spin_OnTouch( item ) {
    num = item.slice( -1 );
    var s = item;
    var parm = findNextParm(s,0);
    if (parm) { //if there was a parameter marker
        var name = s.slice(0, parm-1); //text before first parm
        var parms=""; //units for the parm
        var aryLay=[]; //an array to hold the lines
        dlgTxt = app.CreateDialog( name ); //make a dialog
        layDlg = app.CreateLayout( "linear", "Vertical,Left" ); //overall
        dlgTxt.AddLayout( layDlg ); 
        while (parm>0) { //for each parmameter
            s = s.slice(parm); //cut off the prior string
            parm = findNextParm(s,0); //go for the next one
            parms = s.slice(0,parm?parm-1:s.length); //to next or end
            //start a new line
            aryLay.push(app.CreateLayout( "linear", "Horizontal,Left") );
            layDlg.AddChild(aryLay[aryLay.length-1]);
            if (parms.indexOf("=")>0) {//list of #=option?
                //Create a spinner to get the unit
                aryParm.push(app.CreateSpinner(parms.split(" ").slice(1), 0.4, 0.07, "Right" ));
                } 
            else {
                //Create an edit box to get the unit
                aryParm.push(app.CreateTextEdit("", 0.4, 0.07, "Number, Right, SingleLine" ));
                }
            aryLay[aryLay.length-1].AddChild(aryParm[aryParm.length-1]);
            //with the name of the unit
            aryLay[aryLay.length-1].AddChild(app.CreateText(parms,0.4,0.07,"Left, Multiline"));
            }
        //Create an ok button. 
        btnParmOk = app.CreateButton( "Ok", 0.23, 0.1 ); 
        btnParmOk.SetOnTouch( btnParmOk_OnTouch ); 
        layDlg.AddChild( btnParmOk ); 
        //Show dialog.
        dlgTxt.Show();
        } // Done with parameterized items

    s = edt.GetText() + cmds[item];
    if ("m3" == cmds[item]) { //UART needs baud, data/parity, stop, polarity, out 
        btnUart_OnTouch();
        }
    if ("D" == cmds[item]) {
        s = "";
        btnMultimeter_OnTouch();
        }
    edt.SetText( s );
    edt.SetCursorPos( s.length ); //move cursor to end of string
    }

//Called when user presses Ok on parameter entry dialog
function btnParmOk_OnTouch() { 
    for(var i=0; i<aryParm.length; i++) { //for each parameter
        //get it's value and append it to what we will send
        edt.SetText(edt.GetText()+" "+aryParm[i].GetText().split("=")[0]);
        aryParm[i] = null;
        }
    aryParm = []; //clear it for next time
    dlgTxt.Hide(); //hope that garbage collects... nope

    }

//helper to find either # or % in the parameter description
function findNextParm(item, start) {
    var lb=item.indexOf("#",start)+1, per = item.indexOf("%",start)+1;
    if ( (lb) + (per) > 0 ) { //if we found any parameter markers
        if (lb) {if (per && (per<lb)) return per; else return lb; }
        if (per) {if (lb && (lb<per)) return lb; else return per; }
        }
    return 0;
    }

//called when the user selects UART mode
function btnUart_OnTouch() {  
    var txt="";
    dlgTxt = app.CreateDialog( "UART mode" );
        
    //Create a layout for dialog.
    layDlg = app.CreateLayout( "linear", "Vertical,Left" );
    //layDlg.SetPadding( 0.02, 0, 0.02, 0.02 );
    dlgTxt.AddLayout( layDlg );
    layDlgL1 = app.CreateLayout( "linear", "Horizontal,Left" );
    layDlg.AddChild(layDlgL1);
    //Create baud spinner.
    txt ="1. 300,2. 1200,3. 2400,4. 4800,5. 9600,6. 19200,7. 38400,";
    txt+="8. 57600,9. 115200"
    spinBaud = app.CreateSpinner(txt , 0.4 );
    layDlgL1.AddChild( spinBaud );
        
    //Create data/parity spinner
    UartDP =["None 8","Even 8","Odd 8","None 9"];
    spinDP = app.CreateSpinner(UartDP.join(",") , 0.3 );
    layDlgL1.AddChild( spinDP );
        
    //Create stop bits spinner
    spinSB = app.CreateSpinner("1 ,2 " , 0.2 );
    layDlgL1.AddChild( spinSB );
    
    //Create polarity spinner
    spinP = app.CreateSpinner("1 Idle 1,2 Idle 0" , 0.4 );
    layDlg.AddChild( spinP );
    
    //Create output spinner
    spinOut = app.CreateSpinner("2 Normal (3.3/GND),1 OC (HiZ/GND)" , 0.6 );
    layDlg.AddChild( spinOut );
    
    //Create an ok button. 
    btnUartOk = app.CreateButton( "Ok", 0.23, 0.1 ); 
    btnUartOk.SetOnTouch( btnUartOk_OnTouch ); 
    layDlg.AddChild( btnUartOk ); 
        
    //Show dialog.
    dlgTxt.Show();
    }

//called when user closes UART setup dialog
function btnUartOk_OnTouch(item) {
    var baud=spinBaud.GetText();
    baud = baud.slice(0,baud.indexOf("."))+" ";
    var DP = spinDP.GetText();
    for (var i=UartDP.length;i>=0;i--) {
        if (DP == UartDP[i]) { DP=(i+1)+" "; break; }
        }
    edt.SetText( "m3 "
        +baud
        +DP
        +spinSB.GetText().slice(0,2) 
        +spinP.GetText().slice(0,2) 
        +spinOut.GetText().slice(0,2) 
        );
    dlgTxt.Hide();
    }

//called when user selects ADC loop mode (D)
function btnMultimeter_OnTouch() { 
    dlgTxt = app.CreateDialog( "Multimeter mode" );
        
    //Create a layout for dialog.
    layDlg = app.CreateLayout( "linear", "Vertical,Center" );
    dlgTxt.AddLayout( layDlg );

    //Create a read-only edit box to show responses. 
    edtVolts = app.CreateText( "0.00", 0.95, 0.15, "Right, Monospace" ); 
    edtVolts.SetMargins( 0,0,0,0.01 ); 
    edtVolts.SetBackColor( "#333333" );
    edtVolts.SetTextSize( 56 ); 
    layDlg.AddChild( edtVolts );
  
    layDlgHoriz = app.CreateLayout( "Linear", "Horizontal" );
    layDlg.AddChild( layDlgHoriz );
    layDlgHoriz.AddChild( app.CreateText( "Scale:" ) );
    
    spinVolts = app.CreateSpinner( "x1,x5,x10,x25,x50,x100", 0.2 );
    spinVolts.SetOnChange( spinVolts_onTouch );
    layDlgHoriz.AddChild( spinVolts );

    btnScaleCal  = app.CreateButton( "Calibrate", 0.3, 0.1 ); 
    btnScaleCal.SetOnTouch( btnScaleCal_OnTouch ); 
    layDlgHoriz.AddChild( btnScaleCal ); 
    layDlg.AddChild( app.CreateText( "(Calibrate will turn on power supplies!)" ) );
    txtScaleCal = null;

    //Create an ok button. 
    btnMultimeterOk  = app.CreateButton( "Exit", 0.23, 0.1 ); 
    btnMultimeterOk.SetOnTouch( btnMultimeterOk_OnTouch ); 
    layDlg.AddChild( btnMultimeterOk ); 
     
    //Show dialog.
    dlgTxt.Show();
    Send("d");
    }

function btnScaleCal_OnTouch() {
    if (!txtScaleCal) { //if we haven't already entered this mode
        layDlg.mode=mode; //save the starting mode locally
        if ("HiZ>"==mode) { 
            Send("m2");
            app.ShowPopup("No power in HiZ, switching to 1-WIRE");
            }
        Send("W"); //Power UP!
        txtScaleCal = app.CreateText( //teach user to connect scale pot
             "1. Connect +5 volt power and ground across potentiometer\n"
            +"2. Connect ADC to potentiometer wiper\n"
            +"3. Select desired scale\n"
            +"4. Trim potentiometer to show power supply voltage (5 V)\n"
            +"5. Disconnect +5 volt power from potentiometer\n"
            +"6. Connect voltage to be measured\n"
            +"(click Calibrate to close)\n"
            ,0.8, 0.4, "Left, Multiline");
        layDlg.AddChild( txtScaleCal );
        }
    else { //if we are already in calibrate mode, get out
        if ("HiZ>"==layDlg.mode) { 
            Send("m1");
            app.ShowPopup("Switching back to HiZ");
            }
        Send("w"); //Power Down
        layDlg.DestroyChild(txtScaleCal);
        txtScaleCal = null;
        }
    }

function spinVolts_onTouch( item ) {
    scaleADC = item.substring(1); //scale is after the "x"
    }
    
function btnMultimeterOk_OnTouch() { 
    if (txtScaleCal) { //if we are still in calibration mode
        btnScaleCal_OnTouch(); //pretend the user closed it
        }
    layDlg.DestroyChild(edtVolts); //destroy the edit box
    edtVolts = undefined; //and forget it so we don't funnel responses there.
    dlgTxt.Hide(); //hide the dialog
    Send("d"); //one last reading so the user as a record of it.
    }

//Check connection and send data.  
function Send( s ) { 
    if( usb ) usb.Write( s+"\r" ); 
    else app.ShowPopup( "Please connect" ); 
    }

//Called when we get data from the BusPirate
function usb_OnReceive( data ) {
    if (edt.GetText()=="hostname -I") {
       if (data.indexOf("hostname -I")==-1) {
            var a=data;
            txt.SetText("Status: "+a);
            edt.SetText(""); //must clear after first returned line
            }
        }
    //Need to translate tabs into spaces.
    var lines = data.split("\n");
    var line; //line outside for scope so it is retained after loop ends
    for (var l = 0; l < lines.length; l++) {
        line="";
        tabs = lines[l].split("\t");
        for (var i = 0; i < tabs.length-1; i++) {
            line += tabs[i]+("        ").slice(0,8-(tabs[i].length % 8));
            }
        line += tabs[i]; //don't expand the last bit of text.
        if ( l < lines.length - 1 ) line += "\n";
        log += line;
        }
    //last line of returned data could be our mode.
    if (modes.indexOf(line)>0 && mode!=line) {
        mode=line; 
        txt.SetText("Status: "+mode);
        }
    //scroll extra lines off the top
    var logLines = log.split("\n");
    //calculate the longest line and set font size accordingly
    var maxChars = 0;
    for (var line in logLines) {
        maxChars = Math.max(maxChars, logLines[line].length);
        }
    //we want 8 point when the line is 80(?ish) and up to 14 point at 10.
    edtReply.SetTextSize(Math.min(16-maxChars/10,14));
    maxLines = edtReply.GetMaxLines()-1;
    logLines = logLines.slice( -maxLines );
    log = logLines.join("\n").toString();
    edtReply.SetText( log );
    }
