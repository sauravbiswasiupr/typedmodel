"use strict";

var _ = require("lodash");

var AModel = null;
var types = {
  "bool" : {
    checkFn : function(obj) { return _.isNull(obj) || _.isBoolean(obj); }
  },
  "string" : {
    checkFn : function(obj) { return _.isNull(obj) || _.isString(obj); }
  },
  "number" : {
    checkFn : function(obj) { return _.isNull(obj) || _.isNumber(obj); }
  },
  "date" : {
    checkFn : function(obj) { return _.isNull(obj) || _.isDate(obj); }
  },
  "array" : {
    checkFn : function(obj) { return _.isNull(obj) || _.isArray(obj); }
  }
};

function camelCase(input) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function Model(props, converters, diffFn)
{
  var _attributes     = {};
  var _attributeNames = [];

  var _isDeleted   = false;
  var _isImmutable = false;
  var _primaryKey  = [];
  var _keys        = {};

  var self = this;

  _.forEach(converters, function(value, key) {
    var fName = camelCase(key);
    self["set" + fName] = function(data) {
      self.set(data, key);
    };

    self["to" + fName] = function() {
      self.convertTo(key);
    };
  });

  for (var key in props) {
    _attributeNames.push(key);
    var prop = props[key];
    if (!_.isObject(prop))
        throw new Error("Invalid property. Property must be an object");

    if (_.isUndefined(prop).$type)
        throw new Error("Invalid property type. Undefined $type attribute");

    var Type  = prop.$type;

    if (prop.$pk) {
      _primaryKey.push(key);
      _keys[key] = true;
    }

    var defaultValue = null;
    if (prop.$default || _.isEqual(prop.$default, "")) {
      if (_.isFunction(prop.$default))
        defaultValue = prop.$default();
      else
        defaultValue = prop.$default;
    }

    if (types.hasOwnProperty(Type)) {
      _attributes[key] = {
        type    : Type,
        checkFn : types[Type].checkFn,
        value   : defaultValue
      };
    } else if ((new Type()) instanceof Model) {
      _attributes[key] = {
        type    : "model",
        Type    : Type,
        checkFn : function(obj)
        {
          if (_.isNull(obj))
            return true;

          var Type = this.Type;
          return Type.prototype.isPrototypeOf(obj);
        },
        value   : defaultValue
      };
    } else if ((new Type()) instanceof AModel) {
      _attributes[key] = {
        type    : "arraymodel",
        Type    : Type,
        checkFn : function(obj)
        {
          if (_.isNull(obj))
            return true;

          var Type = this.Type;
          return Type.prototype.isPrototypeOf(obj);
        },
        value   : defaultValue
      };
    } else
        throw new Error("Invalid property type");

    if (!_attributes[key].checkFn(defaultValue))
      throw new Error("Invalid $default value for key " + key + ": " + defaultValue);
  }

  var convertFrom = function(data, type)
  {
    if (_.isObject(converters) && converters.hasOwnProperty(type)) {
      if (_.isFunction(converters[type].fromFn)) {
        converters[type].fromFn(data, self);
        return;
      }
    }

    throw new Error("Cannot convert it to " + type);
  };

  var convertTo = function(type)
  {
    if (_.isObject(converters) && converters.hasOwnProperty(type)) {
      if (_.isFunction(converters[type].toFn))
        return converters[type].toFn(_.cloneDeep(_attributes));
      }

    throw new Error("Cannot convert it to", type);
  };

  this.set = function(data, type)
  {
    if (_isImmutable)
      throw new Error("Object is immutable");

    if (!_.isObject(data))
      throw new Error("Invalid object");

    if (type) {
      convertFrom(data, type);
      return;
    }

    for (var key in data) {
      if (!_attributes.hasOwnProperty(key))
          throw new Error("Invalid attribute " + key);
      else if (!_attributes[key].checkFn(data[key])) {
        if (!_.isUndefined(data[key]))
          throw new Error("Invalid attribute " + key);

        _attributes[key].value = null;
      } else
        _attributes[key].value = data[key];
    }
  };

  this.get = function(key)
  {
    if (!_attributes.hasOwnProperty(key))
      throw new Error("Trying to access an invalid key");

    return _attributes[key].value;
  };

  this.attributeNames = function()
  {
    return _attributeNames;
  };

  this.primaryKey = function()
  {
    var obj = {};
    _.forEach(_primaryKey, function(key) {
      obj[key] = _attributes[key].value;
    });

    return obj;
  };

  this.toJSON = function()
  {
    var obj = {};
    for (var key in _attributes) {
      var attr = _attributes[key];
      if (_.isNull(attr.value))
        obj[key] = null;
      else if (_.isEqual(attr.type, "array")) {
        var array = obj[key] = [];
        for (var i = 0; i < attr.value.length; ++i) {
          var value = attr.value[i];
          if (value instanceof Model)
            array.push(value.toJSON());
          else
            array.push(value);
        }
      } else if (_.isEqual(attr.type, "model") || _.isEqual(attr.type, "arraymodel")) {
        obj[key] = attr.value.toJSON();
      } else
          obj[key] = attr.value;
    }

    if (this.isDeleted())
      obj.$op = "delete";

    return obj;
  };

  this.toString = function()
  {
    return JSON.stringify(this.toJSON(), null, 2);
  };

  this.isEqual = function(obj)
  {
    if (_.isEqual(this, obj))
      return true;

    if (!_.isEqual(_attributeNames, obj.attributeNames()))
      return false;

    for (var key in _attributes) {
      var attr1 = _attributes[key];
      var attr2 = obj.get(key);
      if (_.isEqual(attr1.type, "model")) {
        if (!attr1.value.isEqual(attr2))
          return false;
      } else if (attr1.value !== attr2)
        return false;
    }

    return true;
  };

  this.setDeleted = function()
  {
    _isDeleted = true;
  };

  this.isDeleted = function()
  {
    return _isDeleted;
  };

  this.copy = function()
  {
    if (_isImmutable)
      return this;

    return this.mutableCopy();
  };

  this.mutableCopy = function()
  {
    var Type = this.constructor;
    var result = new Type();

    _.forEach(_attributes, function(data, key) {
      var newAttr = {};
      if (data.value instanceof Model || data.value instanceof AModel) {
        newAttr[key] = data.value.mutableCopy();
      } else
        newAttr[key] = _.cloneDeep(data.value);

      result.set(newAttr);
    });

    return result;
  };

  var setAttr = function(key, value, result)
  {
    var newAttr = {};
    newAttr[key] = value;
    result.set(newAttr);
  };

  this.diff = function(obj)
  {
    if (_.isEqual(this, obj))
      return null;

    if (!obj) {
      var copy = this.mutableCopy();
      copy.setDeleted();
      copy.immutable();
      return copy;
    }

    var Type   = this.constructor;
    var result = new Type();
    if (diffFn)
      return diffFn(this, obj, result);

    var isDifferent = false;
    var attributes = this.attributeNames();
    for (var i = 0; i < attributes.length; ++i) {
      var key = attributes[i];
      var attr1 = this.get(key);
      var attr2 = obj.get(key);

      if (attr1 instanceof Model || attr1 instanceof AModel) {
        var newModel = attr1.diff(attr2);
        if (newModel) {
          setAttr(key, newModel, result);
          isDifferent = true;
        } else
          result.removeAttribute(key);
      } else if (_keys.hasOwnProperty(key)) {
        if (!_.isEqual(attr1, attr2))
          throw new Error(key + " must have same value " + attr1 + ", " + attr2);
        setAttr(key, attr1, result);
      } else if (_.isEqual(attr1, attr2))
        result.removeAttribute(key);
      else {
        setAttr(key, attr2, result);
        isDifferent = true;
      }
    }

    if (!isDifferent)
      return null;

    return result;
  };

  this.removeAttribute = function(attr)
  {
    if (_isImmutable)
      throw new Error("Object is Immutable");

    delete _attributes[attr];
  };

  this.immutable = function()
  {
    if (_isImmutable)
      throw new Error("Object is Immutable");

    _isImmutable = true;

    for (var key in _attributes) {
      var attribute = _attributes[key];
      if (_.isEqual(attribute.type, "model") && attribute.value)
        attribute.value.immutable();
    }

    return this;
  };

  this.isImmutable = function()
  {
    return _isImmutable;
  };

  Object.freeze(this);
}

function ArrayModel(Type, converters, diffFn)
{
  if (!(new Type()) instanceof Model)
    throw new Error("Type must be inherit from Model");

  var _vector = [];
  var _isImmutable = false;

  this.insertAt = function(idx, obj)
  {
    if (_isImmutable)
      throw new Error("Object is immutable");

    if (_vector.length < idx)
      throw new Error("Can't insert in the desired index");

    if (!(obj instanceof Type))
      throw new Error("Cannot add the object. Invalid type");

    _vector.splice(idx, 0, obj);
  };

  this.append = function(obj)
  {
    if (_isImmutable)
      throw new Error("Object is immutable");

    if (!(obj instanceof Type))
      throw new Error("Cannot add the object. Invalid type");

    _vector.push(obj);
  };

  this.prepend = function(obj)
  {
    this.insertAt(0, obj);
  };

  this.removeAt = function(idx)
  {
    if (_isImmutable)
      throw new Error("Object is immutable");

    _vector.splice(idx, 1);
  };

  this.get = function(idx)
  {
    return _vector[idx];
  };

  this.length = function()
  {
    return _vector.length;
  };

  this.toJSON = function()
  {
    var ret = [];
    _.forEach(_vector, function(obj)
    {
      ret.push(obj.toJSON());
    });

    return ret;
  };

  this.toString = function()
  {
    return JSON.stringify(this.toJSON(), null, 2);
  };

  this.isEqual = function(obj)
  {
    if (_.isEqual(obj, this))
      return true;

    if (obj.length() != this.length())
      return false;

    for (var i = 0; i < _vector.length; ++i) {
      if (!this.get(i).isEqual(obj.get(i)))
        return false;
    }

    return true;
  };

  this.copy = function()
  {
    if (_isImmutable)
      return this;

    return this.mutableCopy();
  };

  this.mutableCopy = function()
  {
    var Type = this.constructor;
    var result = new Type();

    _.forEach(_vector, function(data) {
      result.append(data.mutableCopy());
    });

    return result;
  };

  this.diff = function(obj)
  {
    if (_.isEqual(this, obj))
      return null;

    var Type   = this.constructor;
    var result = new Type();
    if (!obj) {
      for (var i = 0; i < _vector.length; ++i)
        result.append(_vector[i].diff(null));

      return result;
    }

    if (diffFn)
      return diffFn(this, obj, result);

    var key, attr, map = {};
    for (i = 0; i < _vector.length; ++i) {
      key = JSON.stringify(_vector[i].primaryKey());
      map[key] = _vector[i];
    }

    for (i = 0; i < obj.length(); ++i) {
      key = JSON.stringify(obj.get(i).primaryKey());
      if (map.hasOwnProperty(key)) {
        attr = map[key].diff(obj.get(i));
        if (attr)
          result.append(attr);
        delete map[key];
      } else
        result.append(obj.get(i));
    }

    for (key in map)
      result.append(map[key].diff(null));

    if (!result.length())
      return null;

    return result;
  };

  this.immutable = function()
  {
    _isImmutable = true;

    _.forEach(_vector, function(obj)
    {
      obj.immutable();
    });

    return this;
  };

  this.isImmutable = function()
  {
    return _isImmutable;
  };

  Object.freeze(this);
}

module.exports.Model = Model;
module.exports.ArrayModel = AModel = ArrayModel;
