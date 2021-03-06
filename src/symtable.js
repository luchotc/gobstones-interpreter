import { i18n, i18nPosition } from './i18n';
import { GbsSyntaxError } from './exceptions';

/* Description of a field */
class FieldDescriptor {
  constructor(typeName, constructorName, index) {
    this._typeName = typeName;
    this._constructorName = constructorName;
    this._index = index;
  }

  get typeName() {
    return this._typeName;
  }

  get constructorName() {
    return this._constructorName;
  }

  get index() {
    return this._index;
  }
}

/* Local name categories */
export const LocalVariable = Symbol.for('LocalVariable');
export const LocalParameter = Symbol.for('LocalParameter');
export const LocalIndex = Symbol.for('LocalIndex');

/* Description of a local name */
class LocalNameDescriptor {
  constructor(category, position) {
    this._category = category;
    this._position = position;
  }

  get category() {
    return this._category;
  }

  get position() {
    return this._position;
  }
}

function fail(startPos, endPos, reason, args) {
  throw new GbsSyntaxError(startPos, endPos, reason, args);
}

/* A symbol table keeps track of definitions, associating:
 * - procedure and function names to their code
 * - type definitions, constructors, and fields
 */
export class SymbolTable {
  constructor() {
    this._program = null;

    /* true iff the program is interactive */
    this._isInteractiveProgram = false;

    /* Each procedure name is mapped to its definition */
    this._procedures = {};

    /* Each procedure name is mapped to its parameters */
    this._procedureParameters = {};

    /* Each function name is mapped to its definition */
    this._functions = {};

    /* Each function name is mapped to its parameters */
    this._functionParameters = {};

    /* Each type name is mapped to its definition */
    this._types = {};

    /* Each type name is mapped to a list of constructor names */
    this._typeConstructors = {};

    /* Each constructor name is mapped to its declaration */
    this._constructors = {};

    /* Each constructor name is mapped to its type name */
    this._constructorType = {};

    /* Each constructor name is mapped to a list of field names */
    this._constructorFields = {};

    /* Each field name is mapped to a list of field descriptors.
     * Each field descriptor is of the form
     *   new FieldDescriptor(typeName, constructorName, index)
     * where
     * - 'typeName' is the name of a type
     * - 'constructorName' is the name of a constructor of the given type
     * - 'index' is the index of the given field with respect to the
     *   given constructor (starting from 0)
     */
    this._fields = {};

    /* Local names include parameters, indices and variables,
     * which are only meaningful within a routine.
     *
     * Local names may be bound/referenced in the following places:
     * - formal parameters,
     * - indices of a "foreach",
     * - pattern matching (formal parameters of a "switch"),
     * - assignments and tuple assignments,
     * - reading local variables.
     *
     * _localNames maps a name to a descriptor of the form:
     *   new LocalNameDescriptor(category, position)
     */
    this._localNames = {};
  }

  get program() {
    return this._program;
  }

  isInteractiveProgram() {
    return this._isInteractiveProgram;
  }

  isProcedure(name) {
    return name in this._procedures;
  }

  allProcedureNames() {
    let names = [];
    for (let name in this._procedures) {
      names.push(name);
    }
    return names.sort();
  }

  procedureDefinition(name) {
    if (this.isProcedure(name)) {
      return this._procedures[name];
    } else {
      throw Error('Undefined procedure.');
    }
  }

  procedureParameters(name) {
    if (this.isProcedure(name)) {
      return this._procedureParameters[name];
    } else {
      throw Error('Undefined procedure.');
    }
  }

  isFunction(name) {
    return name in this._functions;
  }

  allFunctionNames() {
    let names = [];
    for (let name in this._functions) {
      names.push(name);
    }
    return names.sort();
  }

  functionDefinition(name) {
    if (this.isFunction(name)) {
      return this._functions[name];
    } else {
      throw Error('Undefined function.');
    }
  }

  functionParameters(name) {
    if (this.isFunction(name)) {
      return this._functionParameters[name];
    } else {
      throw Error('Undefined function.');
    }
  }

  isType(name) {
    return name in this._types;
  }

  typeDefinition(name) {
    if (this.isType(name)) {
      return this._types[name];
    } else {
      throw Error('Undefined type.');
    }
  }

  typeConstructors(name) {
    if (this.isType(name)) {
      return this._typeConstructors[name];
    } else {
      throw Error('Undefined type.');
    }
  }

  isConstructor(name) {
    return name in this._constructors;
  }

  constructorDeclaration(name) {
    if (this.isConstructor(name)) {
      return this._constructors[name];
    } else {
      throw Error('Undefined constructor.');
    }
  }

  constructorType(name) {
    if (this.isConstructor(name)) {
      return this._constructorType[name];
    } else {
      throw Error('Undefined constructor.');
    }
  }

  constructorFields(name) {
    if (this.isConstructor(name)) {
      return this._constructorFields[name];
    } else {
      throw Error('Undefined constructor.');
    }
  }

  isField(name) {
    return name in this._fields;
  }

  fieldDescriptor(name) {
    if (this.isField(name)) {
      return this._fields[name];
    } else {
      throw Error('Undefined field.');
    }
  }

  defProgram(definition) {
    if (this._program !== null) {
      fail(
        definition.startPos, definition.endPos,
        'program-already-defined', [
          i18nPosition(this._program.startPos),
          i18nPosition(definition.startPos)
        ]
      );
    }
    this._program = definition;
  }

  defInteractiveProgram(definition) {
    this.defProgram(definition);
    this._isInteractiveProgram = true;
  }

  defProcedure(definition) {
    let name = definition.name.value;
    if (name in this._procedures) {
      fail(
        definition.name.startPos, definition.name.endPos,
        'procedure-already-defined', [
          name,
          i18nPosition(this._procedures[name].startPos),
          i18nPosition(definition.startPos)
        ]
      );
    }
    let parameters = [];
    for (let parameter of definition.parameters) {
      parameters.push(parameter.value);
    }
    this._procedures[name] = definition;
    this._procedureParameters[name] = parameters;
  }

  defFunction(definition) {
    let name = definition.name.value;
    if (name in this._functions) {
      fail(
        definition.name.startPos, definition.name.endPos,
        'function-already-defined', [
          name,
          i18nPosition(this._functions[name].startPos),
          i18nPosition(definition.startPos)
        ]
      );
    } else if (name in this._fields) {
      let fieldPos =
        this._constructors[this._fields[name][0].constructorName].startPos;
      fail(
        definition.name.startPos, definition.name.endPos,
        'function-and-field-cannot-have-the-same-name', [
          name,
          i18nPosition(definition.startPos),
          i18nPosition(fieldPos)
        ]
      );
    }
    let parameters = [];
    for (let parameter of definition.parameters) {
      parameters.push(parameter.value);
    }
    this._functions[name] = definition;
    this._functionParameters[name] = parameters;
  }

  defType(definition) {
    let typeName = definition.typeName.value;
    if (typeName in this._types) {
      fail(
        definition.typeName.startPos, definition.typeName.endPos,
        'type-already-defined', [
          typeName,
          i18nPosition(this._types[typeName].startPos),
          i18nPosition(definition.startPos)
        ]
      );
    }
    this._types[typeName] = definition;
    let constructorNames = [];
    for (let constructorDeclaration of definition.constructorDeclarations) {
      this._declareConstructor(typeName, constructorDeclaration);
      constructorNames.push(constructorDeclaration.constructorName.value);
    }
    this._typeConstructors[typeName] = constructorNames;
  }

  _declareConstructor(typeName, constructorDeclaration) {
    let constructorName = constructorDeclaration.constructorName.value;
    if (constructorName in this._constructors) {
      fail(
        constructorDeclaration.constructorName.startPos,
        constructorDeclaration.constructorName.endPos,
        'constructor-already-defined', [
          constructorName,
          i18nPosition(this._constructors[constructorName].startPos),
          i18nPosition(constructorDeclaration.startPos)
        ]
      );
    }
    this._constructors[constructorName] = constructorDeclaration;
    this._constructorType[constructorName] = typeName;

    let constructorFields = {};
    let fieldNames = [];
    let index = 0;
    for (let fieldName of constructorDeclaration.fieldNames) {
      if (fieldName.value in constructorFields) {
        fail(
          fieldName.startPos, fieldName.endPos,
          'repeated-field-name',
          [constructorName, fieldName.value]
        );
      }
      constructorFields[fieldName.value] = true;
      fieldNames.push(fieldName.value);
      this._declareField(
        fieldName.startPos, fieldName.endPos,
        typeName, constructorName, fieldName.value, index
      );
      index++;
    }
    this._constructorFields[constructorName] = fieldNames;
  }

  _declareField(startPos, endPos, typeName, constructorName, fieldName, index) {
    if (fieldName in this._functions) {
      fail(
        startPos, endPos,
        'function-and-field-cannot-have-the-same-name', [
          fieldName,
          i18nPosition(this._functions[fieldName].startPos),
          i18nPosition(startPos)
        ]
      );
    }
    if (!(fieldName in this._fields)) {
      this._fields[fieldName] = [];
    }
    this._fields[fieldName].push(
        new FieldDescriptor(typeName, constructorName, index)
    );
  }

  /* Adds a new local name, failing if it already exists. */
  addNewLocalName(localName, category) {
    if (localName.value in this._localNames) {
      fail(
        localName.startPos, localName.endPos,
        'local-name-conflict', [
          localName.value,
          i18n(Symbol.keyFor(this._localNames[localName.value].category)),
          i18nPosition(this._localNames[localName.value].position),
          i18n(Symbol.keyFor(category)),
          i18nPosition(localName.startPos)
        ]
      );
    }
    this.setLocalName(localName, category);
  }

  /* Sets a local name.
   * It fails if it already exists with a different category. */
  setLocalName(localName, category) {
    if (localName.value in this._localNames &&
        this._localNames[localName.value].category !== category) {
      fail(
        localName.startPos, localName.endPos,
        'local-name-conflict', [
          localName.value,
          i18n(Symbol.keyFor(this._localNames[localName.value].category)),
          i18nPosition(this._localNames[localName.value].position),
          i18n(Symbol.keyFor(category)),
          i18nPosition(localName.startPos)
        ]
      );
    }
    this._localNames[localName.value] =
      new LocalNameDescriptor(category, localName.startPos);
  }

  /* Removes a local name. */
  removeLocalName(localName) {
    delete this._localNames[localName.value];
  }

  /* Removes all local names. */
  exitScope() {
    this._localNames = {};
  }

}

