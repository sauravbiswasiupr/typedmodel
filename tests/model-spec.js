"use strict";

var _     = require("lodash");
var model = require("../model");

function MySubModel(id, title)
{
  var converters = {
    "c1" : {
      fromFn: function(from, to) {
        to.set({
          id    : from.myId,
          title : from.myTitle
        });
      }
    },
    "c2" : {
      fromFn: function(from, to) {
        to.set({
          id    : from.id + from.name,
          title : from.title
        });
      }
    }
  };

  _.extend(this, new model.Model({
    id    : { $type : "string", $pk : true },
    title : { $type : "string" }
  }, converters));

  if (id && title) {
    this.set({
      id    : id,
      title : title
    });
  }

  this.constructor = MySubModel;
}

MySubModel.prototype   = Object.create(model.Model.prototype);

function MyModel()
{
  _.extend(this, new model.Model({
    id       : { $type : "string", $default : "default", $pk : true },
    subModel : { $type : MySubModel                                 }
  }));

  this.constructor = MyModel;
}

MyModel.prototype = Object.create(model.Model.prototype);

function MySubModelArray()
{
  _.extend(this, new model.ArrayModel(MySubModel));

  this.constructor = MySubModelArray;
}

MySubModelArray.prototype = Object.create(model.ArrayModel.prototype);

function MyModelWithArray()
{
  _.extend(this, new model.Model({
    id        : { $type : "string", $default : "default", $pk : true },
    subModels : { $type : MySubModelArray                            }
  }));

  this.constructor = MyModelWithArray;
}

MyModelWithArray.prototype = Object.create(model.Model.prototype);

function MySubModel1(id, title, name)
{
  _.extend(this, new model.Model({
    id    : { $type : "string", $pk : true },
    title : { $type : "string" },
    name  : { $type : "string" }
  }));

  if (id && title && name) {
    this.set({
      id    : id,
      title : title,
      name  : name
    });
  }

  this.constructor = MySubModel1;
}

MySubModel1.prototype = Object.create(model.Model.prototype);

function MySubModel1Array()
{
  _.extend(this, new model.ArrayModel(MySubModel1));

  this.constructor = MySubModel1Array;
}

MySubModel1Array.prototype = Object.create(model.ArrayModel.prototype);

function MyModel1WithArray()
{
  _.extend(this, new model.Model({
    id        : { $type : "string", $default : "default", $pk : true },
    subModels : { $type : MySubModel1Array                           }
  }));

  this.constructor = MyModel1WithArray;
}

MyModel1WithArray.prototype = Object.create(model.Model.prototype);

describe("Test Generic Model", function()
{
  it("should create a model", function()
  {
    var mySubModel = new MySubModel();
    mySubModel.set({
      id    : "123",
      title : "Title"
    });

    var myModel = new MyModel();
    myModel.set({
      subModel : mySubModel
    });

    expect(_.isEqual({
      id : "default"
    }, myModel.primaryKey())).toBe(true);

    expect(_.isEqual({
      id       : "default",
      subModel : {
        id    : "123",
        title : "Title"
      }
    }, myModel.toJSON())).toBe(true);
  });

  // TODO: Test the Equals!!

  it("should complain about primitive", function()
  {
    var mySubModel = new MySubModel();
    expect(function() {
      mySubModel.set({
        id    : "123",
        title : 123
        });
    }).toThrow(new Error("Invalid attribute title"));
  });

  it("should complain about model", function()
  {
    var myModel = new MyModel();
    expect(function()
    {
      myModel.set({
        subModel : new MySubModel1()
      });
    }).toThrow(new Error("Invalid attribute subModel"));
  });

  it("should work with converters", function()
  {
    var mySubModel = new MySubModel();
    mySubModel.setC1({
      myId    : "123",
      myTitle : "Something"
    });

    expect(_.isEqual({
      id    : "123",
      title : "Something"
    }, mySubModel.toJSON())).toBe(true);

    mySubModel.setC2({
      id      : "123",
      name    : "test",
      title   : "abc",
      myTitle : "Something"
    });

    expect(_.isEqual({
      id    : "123test",
      title : "abc"
    }, mySubModel.toJSON())).toBe(true);
  });

  it("should support array models", function()
  {
    var mySubModelArray = new MySubModelArray();
    mySubModelArray.append(new MySubModel("123", "Test"));
    mySubModelArray.append(new MySubModel("456", "Test1"));

    var modelWithArray = new MyModelWithArray();
    modelWithArray.set({
      id        : "1",
      subModels : mySubModelArray
    });

    expect(_.isEqual(modelWithArray.toJSON(), {
      id        : "1",
      subModels : [{
        id    : "123",
        title : "Test"
      }, {
        id    : "456",
        title : "Test1"
      }]
    })).toBe(true);

    expect(_.isEqual(modelWithArray.primaryKey(), {
      id : "1"
    })).toBe(true);
  });

  it("should copy a model", function()
  {
    var mySubModel = new MySubModel();
    mySubModel.set({
      id    : "123",
      title : "Title"
    });

    var myModel = new MyModel();
    myModel.set({
      subModel : mySubModel
    });

    var modelCopy = myModel.copy();
    expect(_.isEqual({
      id       : "default",
      subModel : {
        id    : "123",
        title : "Title"
      }
    }, modelCopy.toJSON())).toBe(true);
  });

  it("should copy an array model", function()
  {
    var mySubModelArray = new MySubModelArray();
    mySubModelArray.append(new MySubModel("123", "Test"));
    mySubModelArray.append(new MySubModel("456", "Test1"));

    var modelWithArray = new MyModelWithArray();
    modelWithArray.set({
      id        : "1",
      subModels : mySubModelArray
    });

    var modelCopy = modelWithArray.copy();
    expect(_.isEqual(modelCopy.toJSON(), {
      id        : "1",
      subModels : [{
        id    : "123",
        title : "Test"
      }, {
        id    : "456",
        title : "Test1"
      }]
    })).toBe(true);
  });

  it("should diff a model", function()
  {
    var mySubModel = new MySubModel();
    mySubModel.set({
      id    : "123",
      title : "Title"
    });

    var mySubModel1 = new MySubModel();
    mySubModel1.set({
      id    : "123",
      title : "Titl"
    });

    var myModel = new MyModel();
    myModel.set({
      id : "test",
      subModel : mySubModel
    });

    var myModel1 = new MyModel();
    myModel1.set({
      id : "test",
      subModel : mySubModel1
    });

    var modelDiff = myModel.diff(myModel1);

    expect(_.isEqual(modelDiff.toJSON, {
      id       : "test",
      subModel : {
        id    : "123",
        title : "Titl"
      }
    }));

    myModel1.set({ subModel : mySubModel });
    modelDiff = myModel.diff(myModel1);
    expect(modelDiff).toBeNull();

    mySubModel1.set({ title : "Title" });
    myModel1.set({ subModel : mySubModel1 });
    modelDiff = myModel.diff(myModel1);
    expect(modelDiff).toBeNull();

    var mySubModelArray = new MySubModel1Array();
    mySubModelArray.append(new MySubModel1("123", "Test", "leo"));
    mySubModelArray.append(new MySubModel1("456", "Test1", "bispo"));

    var modelWithArray = new MyModel1WithArray();
    modelWithArray.set({
      id        : "1",
      subModels : mySubModelArray
    });

    var modelCopy = modelWithArray.copy();
    modelCopy.get("subModels").get(0).set({ title : "Brasil" });
    modelCopy.get("subModels").append(new MySubModel1("89", "Test1", "abc"));
    mySubModelArray.append(new MySubModel1("789", "Test1", "t"));

    modelDiff = modelWithArray.diff(modelCopy);

    expect(_.isEqual(modelDiff.toJSON(), {
      id        : "1",
      subModels : [{
        id    : "123",
        title : "Brasil"
      }, {
        id    : "89",
        title : "Test1",
        name  : "abc"
      }, {
        id    : "789",
        title : "Test1",
        name  : "t",
        $op   : "delete"
      }]
    })).toBe(true);
  });
});