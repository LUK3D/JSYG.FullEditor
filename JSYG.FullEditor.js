/*jshint forin:false, eqnull:true*/
/* globals JSYG*/

(function(factory) {

    if (typeof define != "undefined" && define.amd) define("jsyg-fulleditor",["jsyg","jsyg-editor","jsyg-texteditor","jsyg-zoomandpan","jsyg-pencil","jsyg-shapedrawer","jsyg-undoredo","jquery-hotkeys","jsyg-fetch"],factory);
    else if (typeof JSYG != "undefined") {

        var deps = ["Editor","TextEditor","ZoomAndPan","Pencil","ShapeDrawer","UndoRedo","fetch"];

        deps = deps.map(function(dep) {
            if (!JSYG[dep]) throw new Error("JSYG."+dep+" is missing");
            return JSYG[dep];
        });

        deps.unshift(JSYG);

        factory.apply(null,deps);
    }
    else throw new Error("JSYG is needed");

})(function(JSYG,Editor,TextEditor,ZoomAndPan,Pencil,ShapeDrawer,UndoRedo) {

    "use strict";

    function FullEditor(node,opt) {
        
        this._bindFunctions();
        
        this._init();
        
        this._keyShortCuts = {};

        if (node) this.setNode(node);
                
        if (opt) this.enable(opt);
    }

    FullEditor.prototype = Object.create(JSYG.StdConstruct.prototype);

    FullEditor.prototype.constructor = FullEditor;
    
    FullEditor.prototype.onload = null;
    
    FullEditor.prototype.ondrag = null;
    
    FullEditor.prototype.onchange = null;
    
    //events
    [
        'onload',
        'ondrag',
        'onchange',
        'onzoom',
        
        'onenablemousepan',
        'ondisablemousepan',
        
        'onenablemarqueezoom',
        'ondisablemarqueezoom',
        
        'onenableedition',
        'ondisableedition',
        
        'onenableinsertelement',
        'ondisableinsertelement',
        
        'onenableinserttext',
        'ondisableinserttext',
        
        'onenablepathdrawer',
        'ondisablepathdrawer',
        
        'onenableshapedrawer',
        'ondisableshapedrawer'
        
    ].forEach(function(event) { FullEditor.prototype[event] = null; });
    
    FullEditor.prototype.idContainer = "containerDoc";
    
    FullEditor.prototype._init = function() {
        
        this._initUndoRedo();

        this._initShapeEditor();

        this._initZoomAndPan();

        this._initTextEditor();

        this._initPathDrawer();

        this._initShapeDrawer();
    };
        
    FullEditor.prototype._bindFunctions = function() {
        
        for (var n in this) {
            
            if (typeof(this[n]) == "function" && n.charAt(0) != '_') this[n] = this[n].bind(this);
        }
      
        this._onchange = this._onchange.bind(this);
        
        return this;
    };
       
    FullEditor.prototype.registerKeyShortCut = function(key,fct) {
        
        if (JSYG.isPlainObject(key)) {
            for (var n in key) this.registerKeyShortCut(n,key[n]);
            return this;
        }
        
        if (this._keyShortCuts[key]) this._disableKeyShortCut(key);
                
        this._keyShortCuts[key] = fct;
        
        if (this.enabled) this._enableKeyShortCut(key,fct);
        
        return this;
    };
    
    FullEditor.prototype.unregisterKeyShortCut = function(key) {
        
        var that = this;
        
        if (Array.isArray(key) || arguments.length > 1 && (key = [].slice.call(arguments))) {
            key.forEach(that.unregisterKeyShortCut);
            return this;
        }
                
        this._disableKeyShortCut(key,this._keyShortCuts[key]);
                
        delete this._keyShortCuts[key];
        
        return this;
    };
    
    FullEditor.prototype._enableKeyShortCut = function(key,fct) {
        
        if (typeof fct != 'function') throw new Error(typeof fct + " instead of function expected");
                
        new JSYG(document).on('keydown',null,key,fct);
        
        return this;
    };
    
    FullEditor.prototype._disableKeyShortCut = function(key,fct) {
        
        if (typeof fct != 'function') throw new Error(typeof fct + " instead of function expected");
                        
        new JSYG(document).off('keydown',fct);
        
        return this;
    };
    
    FullEditor.prototype.enableKeyShortCuts = function() {
        
        var keys = this._keyShortCuts;
        
        for (var n in keys) this._enableKeyShortCut(n,keys[n]);
             
        return this;
    };
    
    FullEditor.prototype.disableKeyShortCuts = function() {

        var keys = this._keyShortCuts;
        
        for (var n in keys) this._disableKeyShortCut(n,keys[n]);
                
        return this;
    };
        
    Object.defineProperty(FullEditor.prototype,'editPathCtrlPoints',{
        get : function() {
            return this.shapeEditor.ctrlsCtrlPoints.enabled;
        },
        set:function(value) {
            this.shapeEditor.ctrlsCtrlPoints[ (value ? 'en' : 'dis') + 'able']();
        }
    });
        
    Object.defineProperty(FullEditor.prototype,'resizable',{
        get:function() {
            return this.zoomAndPan.resizable.enabled;  
        },
        set:function(value) {
            this.zoomAndPan.resizable[ (value ? 'en' : 'dis') + 'able']();
        }
    });
        
    Object.defineProperty(FullEditor.prototype,'keepShapesRatio',{
        get:function() {
            return this.shapeEditor.ctrlsResize.keepRatio;  
        },
        set:function(value) {
            value = !!value;
            this.shapeEditor.ctrlsResize.keepRatio = value;
            this._keepShapesRatio = value;
            if (this.shapeEditor.display) this.shapeEditor.update();
        }
    });
        
    Object.defineProperty(FullEditor.prototype,'drawingPathMethod',{
        get:function() {
            return this.pathDrawer.type;  
        },
        set:function(value) {
            
            if (value != 'freehand' && value != 'point2point')
                throw new Error("Only 'freehand' and 'point2point' are allowed");
                        
            this.pathDrawer.type = value;
        }
    });
        
    Object.defineProperty(FullEditor.prototype,'autoSmoothPaths',{
        get:function() {
            return this.shapeEditor.ctrlsMainPoints.autoSmooth;
        },
        set:function(value) {
            
            this.shapeEditor.ctrlsMainPoints.autoSmooth = value;
        }
    });
    
    Object.defineProperty(FullEditor.prototype,'useTransformAttr',{
        
        get:function() {
            
            var dragType = this.shapeEditor.ctrlsDrag.type;
            var resizeType = this.shapeEditor.ctrlsResize.type;
            
            if (dragType!=resizeType) throw new Error("dragType and resizeType are not the same");
            
            return dragType;
        },
        
        set:function(value) {
            
            var oldValue = this.useTransformAttr;
            
            if (value != oldValue) {
                                    
                this.shapeEditor.ctrlsDrag.type = value ? 'transform' : 'attributes';
                if (this.shapeEditor.ctrlsDrag.enabled) this.shapeEditor.ctrlsDrag.disable().enable();
                
                this.shapeEditor.ctrlsResize.type = value ? 'transform' : 'attributes';
                if (this.shapeEditor.ctrlsResize.enabled) this.shapeEditor.ctrlsResize.disable().enable();
            }
        }
    });
    
    FullEditor.prototype._currentLayer = null;
    
    Object.defineProperty(FullEditor.prototype,'currentLayer',{
        get : function() {
            return this._currentLayer || this.getDocument();
        },
        set : function(value) {
            var $node = new JSYG(value);
            if (!$node.length) throw new Error("Invalid value for currentLayer. No node found.");
            this._currentLayer = $node[0];
        }
    });
    
    /**
     * 
     */
    FullEditor.prototype.autoEnableEdition = true;
       
    FullEditor.prototype.addLayer = function() {
      
        var g = new JSYG('<g>').appendTo(this.getDocument());
        
        this._currentLayer = g[0];
    };
           
    
    FullEditor.prototype.isGrouped = function() {
        
        var g = this.shapeEditor.target();
        
        return g.getTag() == "g" && g.length == 1;
    };

    FullEditor.prototype.getDocument = function() {

        return document.querySelector( this._getDocumentSelector() );
    };

    FullEditor.prototype._initUndoRedo = function() {
        
        var that = this;

        this.undoRedo = new UndoRedo();
        
        this.undoRedo.on("undo redo",function() {
            that.hideEditors();
            that.trigger("change", that, that.getDocument() );
        });
    };
    
    FullEditor.prototype.hideEditors = function() {
        
        this.shapeEditor.hide();
        this.textEditor.hide();
    };
    
    FullEditor.prototype.enableEdition = function() {
        
        if (!this.shapeEditor.enabled) {
            
            this.shapeEditor.enable();
            this.trigger("enableedition",this,this.getDocument());
        }
    };
    
    FullEditor.prototype.disableEdition = function() {
        
        this.disableInsertElement();
        this.disablePathDrawer();
        this.disableShapeDrawer();
        this.disableMousePan();
        
        this.hideEditors();
        
        if (this.shapeEditor.enabled) this.shapeEditor.disable();
        
        this.trigger("disableedition",this,this.getDocument());
    };
    
    ["copy","cut","paste"].forEach(function(action) {
        
        FullEditor.prototype[action] = function() {
                                
            if (action!=="paste" && !this.shapeEditor.display) return;
            
            this.shapeEditor.clipBoard[action]();
        
            return this;
        };
    });
   
    ["undo","redo"].forEach(function(action) {
        
        FullEditor.prototype[action] = function() {
            
            this.undoRedo[action]();
            
            return this;
        };
        
    });
    
    ["Front","Back","ToFront","ToBack"].forEach(function(type) {
        
        var methode = "moveTarget"+type;
        var methodeTarget = "move"+type;
        
        FullEditor.prototype[methode] = function() {
            
            var target = this.shapeEditor._target;
       
            if (target) {
                new JSYG(target)[methodeTarget]();
                this._onchange();
            }
            
            return this;
        };
    });
    
    FullEditor.prototype._onchange = function() {
                
        this.undoRedo.saveState();
        
        this.trigger("change", this, this.getDocument() );
        
        return this;
    };
    
    FullEditor.prototype._insertFrame = function() {

        var mainFrame = this.zoomAndPan.innerFrame,
        content = new JSYG(mainFrame).children().detach();

        this._frameShadow = new JSYG("<rect>")
            .attr({x:2,y:2})
            .attr("id","frameShadowDoc")
            .appendTo(mainFrame)[0];

        this._frame = new JSYG("<rect>")
            .attr({x:0,y:0})
            .attr("id","frameDoc")
            .appendTo(mainFrame)[0];

        this.containerDoc = new JSYG("<g>")
            .attr("id",this.idContainer)
            .append(content)
            .appendTo(mainFrame)
        [0];

        this._adjustSize();

        return this;
    };

    FullEditor.prototype.repeatDrawing = false;

    FullEditor.prototype.cursorDrawing = "copy";

    FullEditor.prototype._removeFrame = function() {

        var container = new JSYG(this.containerDoc),
        content = container.children();

        new JSYG(this._frame).remove();
        new JSYG(this._frameShadow).remove();
        container.remove();

        content.appendTo(this.zoomAndPan.innerFrame);

        return this;
    };

    FullEditor.prototype._initPathDrawer = function() {

        var that = this;

        this.pathDrawer = new Pencil();

        this.pathDrawer.on("end",function() {

            that._onchange();

            if (that.repeatDrawing) return;

            that.disablePathDrawer();

            if (that.autoEnableEdition) that.shapeEditor.target(this).show();
        });
    };

    FullEditor.prototype._initShapeDrawer = function() {

        var that = this;

        this.shapeDrawer = new ShapeDrawer();
        
        this.editableShapes = "*";

        this.shapeDrawer.on("end",function() {

            that._onchange();

            if (that.repeatDrawing) return;

            that.disableShapeDrawer();

            if (that.autoEnableEdition) that.shapeEditor.target(this).show();
        });
    };
    
    FullEditor.prototype._setCursorDrawing = function() {
        
        if (this.cursorDrawing) this.zoomAndPan.node.style.cursor = this.cursorDrawing;
    };
    
    FullEditor.prototype._removeCursorDrawing = function() {
        
        if (this.cursorDrawing) this.zoomAndPan.node.style.cursor = null;
    };

    FullEditor.prototype.enableShapeDrawer = function(modele) {

        var frame = new JSYG(this.zoomAndPan.innerFrame),
        that = this;

        this.disableEdition();

        function onmousedown(e) {

            e.preventDefault();

            var shape = new JSYG(modele).clone().appendTo( that.currentLayer );

            that.shapeDrawer.draw(e,shape);
        }

        frame.on("mousedown",onmousedown).data("enableDrawingShape",onmousedown);

        this._setCursorDrawing();
        
        this.trigger("enableshapedrawer",this,this.getDocument());

        return this;

    };

    FullEditor.prototype.disableShapeDrawer = function() {

        var frame = new JSYG(this.zoomAndPan.innerFrame),
        fct = frame.data("enableDrawingShape");

        if (!fct) return this;
        
        frame.off("mousedown",fct);
        
        this._removeCursorDrawing();
        
        this.trigger("disableshapedrawer",this,this.getDocument());

        if (this.autoEnableEdition) this.enableEdition();

        return this;
    };

    FullEditor.prototype.enablePathDrawer = function(modele) {

        var frame = new JSYG(this.zoomAndPan.innerFrame),
        that = this;

        this.disableEdition();

        function onmousedown(e) {

            if (that.pathDrawer.inProgress) return;

            e.preventDefault();

            var path = modele ? new JSYG(modele).clone() : new JSYG("<path>");

            path.appendTo( that.currentLayer );

            that.pathDrawer.setNode(path);

            that.pathDrawer.draw(e);
        }

        frame.on("mousedown",onmousedown).data("enablePathDrawer",onmousedown);

        this._setCursorDrawing();
        
        this.trigger("enablepathdrawer",this,this.getDocument());

        return this;
    };

    FullEditor.prototype.disablePathDrawer = function() {

        var frame = new JSYG(this.zoomAndPan.innerFrame),
        fct = frame.data("enablePathDrawer");

        if (!fct) return this;
        
        frame.off("mousedown",fct);
        this._removeCursorDrawing();
        
        this.trigger("disablepathdrawer",this,this.getDocument());

        if (this.autoEnableEdition) this.enableEdition();

        return this;
    };
    
    function isText(elmt) {
        return JSYG.svgTexts.indexOf( new JSYG(elmt).getTag() ) != -1;
    }
    
    FullEditor.prototype.enableInsertElement = function(modele,_isText) {

        var frame = new JSYG(this.zoomAndPan.innerFrame),
        that = this;

        this.disableEdition();

        function onmousedown(e) {

            e.preventDefault();

            var shape = new JSYG(modele).clone(),
            layer = that.currentLayer;

            shape.appendTo(layer).setCenter( shape.getCursorPos(e) );
            
            that._onchange();

            if (that.repeatDrawing) return;
            
            new JSYG(that.node).one('mouseup',function() {
                
                that.disableInsertElement();
                
                that.shapeEditor.target(shape);
               
                if (_isText && isText(shape)) that.textEditor.target(shape).show();
                else that.shapeEditor.show();
                
            });
            
        }

        frame.on("mousedown",onmousedown).data("enableInsertElement",onmousedown);

        this._setCursorDrawing();
        
        this.trigger( "enableinsert" + (_isText ? "text" : "element"), this, this.getDocument() );

        return this;
    };
    
    FullEditor.prototype.disableInsertElement = function(_isText) {

        var frame = new JSYG(this.zoomAndPan.innerFrame),
        fct = frame.data("enableInsertElement");

        if (!fct) return this;
        
        frame.off("mousedown",fct);
        
        this._removeCursorDrawing();
        
        this.trigger( "disableinsert" + (_isText ? "text" : "element"), this, this.getDocument() );

        if (this.autoEnableEdition) this.enableEdition();

        return this;
    };
    
    FullEditor.prototype.enableInsertText = function(modele) {
        
        return this.enableInsertElement(modele,true);
    };
    
    FullEditor.prototype.disableInsertText = function() {

        return this.disableInsertElement(true);
    };
    
    FullEditor.prototype.disableMarqueeZoom = function() {
        
        if (!this.zoomAndPan.marqueeZoom.enabled) return this;
        
        this.zoomAndPan.marqueeZoom.disable().off("end",this.disableMarqueeZoom);
        
        this.trigger("disablemarqueezoom",this,this.getDocument());
        
        if (this.autoEnableEdition) this.enableEdition();
        
        return this;
    };
    
    FullEditor.prototype.enableMarqueeZoom = function(opt) {
        
        if (this.zoomAndPan.marqueeZoom.enabled && !opt) return this;
        
        this.disableEdition();
                
        this.zoomAndPan.marqueeZoom.enable(opt);
        
        this.zoomAndPan.marqueeZoom.on("end",this.disableMarqueeZoom);
        
        this.trigger("enablemarqueezoom",this,this.getDocument());
        
        return this;
    };
    
    FullEditor.prototype.zoom = function(percent) {
        
        this.zoomAndPan.scale( 1 + (percent/100) );
        
        this.trigger("zoom",this,this.getDocument());
        
        return this;
    };
    
    FullEditor.prototype.zoomTo = function(percentage) {
        
        if (percentage == "canvas") this.zoomAndPan.fitToCanvas().scale(0.95);
        else if (JSYG.isNumeric(percentage)) this.zoomAndPan.scaleTo( percentage/100 );
        else throw new Error("argument must be numeric or 'canvas' string");
        
        this.trigger("zoom",this,this.getDocument());
        
        return this;
    };
        


    FullEditor.prototype._initZoomAndPan = function() {
        
        var that = this;

        this.zoomAndPan = new ZoomAndPan();
        this.zoomAndPan.overflow = "auto";
        this.zoomAndPan.scaleMin = 0;

        this.zoomAndPan.resizable.keepViewBox = false;
        this.zoomAndPan.resizable.keepRatio = false;

        this.zoomAndPan.mouseWheelZoom.key = "ctrl";

        this.zoomAndPan.on("change",function() {
            that._updateBoundingBoxes();
            that.shapeEditor.update();
            that.textEditor.update();
        });

        return this;
    };
   

    FullEditor.prototype._initShapeEditor = function() {

        var editor = new Editor();
        var that = this;

        editor.selection.multiple = true;

        new JSYG(editor.container).on("dblclick",function(e) {

            var target = editor.target();

            if (JSYG.svgTexts.indexOf( target.getTag() ) == -1) return;

            that.textEditor.target(target).show();
            that.textEditor.cursor.setFromPos(e);
        });
        
        editor.selection.on("beforedeselect beforedrag",function(e) {

            if (e.target == that.textEditor.container || new JSYG(e.target).isChildOf(that.textEditor.container)) return false;
        });

        editor.on({
            
            show : function() {
                that.textEditor.hide();
            },
            
            change : this._onchange,
            
            drag : function(e) {
                that.trigger("drag", that, e, editor._target);
            }
        });

        //editor.ctrlsDrag.bounds = 0;
        //editor.ctrlsResize.bounds = 0;

        this.shapeEditor = editor;

        return this;
    };

    FullEditor.prototype._initTextEditor = function() {

        var that = this;

        this.textEditor = new TextEditor();

        this.textEditor.on({
            show : function() {
                that.shapeEditor.hide();
            },
            hide : function() {
                if (!that.shapeEditor.display) {
                    //that.shapeEditor.target( that.textEditor.target() );
                    that.shapeEditor.show();
                }
            },
            validate : function() {
                that._onchange();
            }
        });

        return this;
    };

    FullEditor.prototype.setNode = function() {

        JSYG.StdConstruct.prototype.setNode.apply(this,arguments);

        this.zoomAndPan.setNode(this.node);

        this.shapeEditor.setNode(this.node);

        this.textEditor.setNode(this.node);

        return this;
    };
    
    FullEditor.prototype._getDocumentSelector = function() {
      
        return "#" + this.idContainer + " > svg ";
    };

    Object.defineProperty(FullEditor.prototype,'editableShapes',{
        get:function() { return this.shapeEditor.list && this.shapeEditor.list.replace(this._getDocumentSelector(),''); },
        set:function(value) { this.shapeEditor.list = this._getDocumentSelector() + value; }
    });
    
    FullEditor.prototype.enableMousePan = function(opt) {
        
        if (!this.zoomAndPan.mousePan.enabled) {
      
            this.disableEdition();
        
            this.zoomAndPan.mousePan.enable(opt);
                        
            this.trigger("enablemousepan",this,this.getDocument());
        }
        
        return this;
    };
    
    FullEditor.prototype.disableMousePan = function() {
      
        if (this.zoomAndPan.mousePan.enabled) {
            
            this.zoomAndPan.mousePan.disable();
                        
            this.trigger("disablemousepan",this,this.getDocument());
            
            if (this.autoEnableEdition) this.enableEdition();
        }
        
        return this;
    };
    
    Object.defineProperty(FullEditor.prototype,'overflow',{
        
        get : function() { return this.zoomAndPan.overflow; },
       
        set : function(value) {
           
            var displayShapeEditor = this.shapeEditor.display,
            displaytextEditor = this.textEditor.display;
           
            if (displayShapeEditor) this.shapeEditor.hide();
            if (displaytextEditor) this.textEditor.hide();
           
            this.zoomAndPan.overflow = value;
           
            if (displayShapeEditor) this.shapeEditor.show();
            if (displaytextEditor) this.textEditor.show();
        }
    });
    
    FullEditor.prototype.enable = function(opt) {
        
        this.disable();

        if (opt) this.set(opt);

        if (!this.node) throw new Error("node is not defined");

        this.zoomAndPan.enable();

        this._insertFrame();

        this.zoomAndPan.mouseWheelZoom.enable();
        
        //on force les valeurs pour exécuter les fonctions définies dans Object.defineProperty
        if (this._editPathCtrlPoints) this._editPathCtrlPoints = true;
        if (this._resizable) this._resizable = true;

        this.shapeEditor.enableCtrls('drag','resize','rotate','mainPoints');
        
        this.shapeEditor.enable();
        
        this.textEditor.enable();
        
        this.enableKeyShortCuts();
        
        this.enabled = true;

        return this;
    };

    FullEditor.prototype.disable = function() {

        this._removeFrame();

        this.zoomAndPan.disable();

        this.shapeEditor.disable();
        
        this.textEditor.disable();
        
        this.undoRedo.disable();
        
        this.disableKeyShortCuts();
        
        this.enabled = false;

        return this;
    };

    /**
     * Aligne les éléments sélectionnés
     * @param {String} type (top,middle,bottom,left,center,right)
     * @returns {undefined}
     */
    FullEditor.prototype.align = function(type) {
                
        this.shapeEditor.align(type);

        return this;
    };
    
    FullEditor.prototype.target = function(value) {
        
        if (value == null) {
            
            if (this.shapeEditor.display) return this.shapeEditor.target();
            else if (this.textEditor.display) return this.textEditor.target();
            
            return null;
        }
        else {
            
            this.shapeEditor.target( new JSYG(this.getDocument()).find(value) ).show();
        }
        
        return this;
    };
        
    FullEditor.prototype.editText = function(elmt) {
        
        if (elmt == null) elmt = this.target();

        this.textEditor.target(elmt).show();
        
        return this;
    };
    
    FullEditor.prototype.setDimDocument = function(dim) {
      
        new JSYG( this.getDocument() ).setDim(dim);
        
        this._onchange();
        
        this._adjustSize();
        
        return this;
    };
    
    FullEditor.prototype.getDimDocument = function() {
      
        return new JSYG( this.getDocument() ).getDim();
    };
        
    FullEditor.prototype._adjustSize = function() {

        var contenu = new JSYG( this.getDocument() ),
        dim = contenu.length && contenu.getDim() || {width:0, height:0};

        new JSYG(this._frameShadow).add(this._frame).attr({
            width:dim.width,
            height:dim.height
        });

        if (dim.width && dim.height) this.zoomTo('canvas');

        if (!this.shapeEditor.ctrlsDrag.options) this.shapeEditor.ctrlsDrag.options = {};
        if (!this.shapeEditor.ctrlsResize.options) this.shapeEditor.ctrlsResize.options = {};

        this.shapeEditor.ctrlsDrag.options.guides = {
            list : [{x:0},{x:dim.width},{y:0},{y:dim.height}]
        };

        this.shapeEditor.ctrlsResize.options.stepsX = {
            list : [0,dim.width]
        };

        this.shapeEditor.ctrlsResize.options.stepsY = {
            list : [0,dim.height]
        };

        return this;
    };

    FullEditor.prototype.load = function(arg) {

        if (arg instanceof File) return this.loadFile(arg);
        else if (typeof arg == "string") {
            if (arg.indexOf("<?xml") == 0 || arg.indexOf("<svg") == 0)
                return this.loadString(arg);
            else return this.loadURL(arg);
        }
        else return this.loadXML();
    };

    FullEditor.prototype.loadString = function(str) {

        return this.loadXML( JSYG.parseSVG(str) );
    };

    FullEditor.prototype.loadFile = function(file) {

        return new Promise(function(resolve,reject) {

            if (!window.FileReader) throw new Error("your navigator doesn't implement FileReader");

            if (!(file instanceof File)) throw new Error("file argument incorrect");
            
            if (!file.type.match(/svg/)) throw new Error("file format incorrect. SVG file is required.");
            
            var reader = new FileReader();

            reader.onload = function(e) {
		resolve(e.target.result);
            };

            reader.onerror = function(e) {
		reject(new Error("Impossible de charger le fichier"));
            };

            reader['readAsText'](file);
        })
            .then(this.loadString.bind(this));
    };

    FullEditor.prototype.loadURL = function(url) {

        return JSYG.fetch(url).then(function(response) {
            return response.text();
        })
            .then(this.loadString.bind(this));
    };

    FullEditor.prototype.loadXML = function(svg) {

        this.shapeEditor.hide();
        this.textEditor.hide();
        this._clearBoundingBoxes();

        var container = new JSYG('#'+this.idContainer);

        container.empty().append(svg);

        this._adjustSize();

        this.undoRedo.disable().setNode(svg).enable();
        
        this.trigger("load",this,svg);

        return this;
    };
    
    FullEditor.prototype.newDocument = function(width,height) {
      
        var svg = new JSYG('<svg>').setDim( {width:width,height:height} );
        return this.loadXML(svg);
    };
    
    FullEditor.prototype._updateBoundingBoxes = function() {

        new JSYG(this.shapeEditor.list).each(function() {
            var $this = new JSYG(this);
            if ($this.boundingBox("get","display")) $this.boundingBox("update");
        });
    };

    FullEditor.prototype._clearBoundingBoxes = function() {

        new JSYG(this.shapeEditor.list).boundingBox("hide");
    };
    
    FullEditor.prototype.toCanvas = function() {

        return new JSYG(this.getDocument()).toCanvas();
    };
    
    FullEditor.prototype.toSVGString = function() {

        return new JSYG(this.getDocument()).toSVGString(true);
    };
    
    FullEditor.prototype.toSVGDataURL = function() {
        
        return new JSYG(this.getDocument()).toDataURL(true);
    };
    
    FullEditor.prototype.toPNGDataURL = function(format) {

        return this.toCanvas().then(function(canvas) {
            
            return canvas.toDataURL();
        });
    };
   
    FullEditor.prototype.remove = function() {
        
        if (!this.shapeEditor.display) return;
        
        var target = this.shapeEditor.target();
        
        this.shapeEditor.hide();
        
        this._clearBoundingBoxes();
        
        target.remove();
        
        this._onchange();
      
        return this;
    };

    FullEditor.prototype.group = function() {
        
        this.shapeEditor.group();
        
        this._onchange();
        
        return this;
    };
    
    FullEditor.prototype.ungroup = function() {
      
        this.shapeEditor.ungroup();
        
        this._onchange();
        
        return this;
    };


    JSYG.FullEditor = FullEditor;

    return FullEditor;

});