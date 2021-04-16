"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Property = void 0;
const gen_utils_1 = require("./gen-utils");
/**
 * An object property
 */
class Property {
    constructor(model, name, schema, required, options, openApi) {
        var _a;
        this.model = model;
        this.name = name;
        this.schema = schema;
        this.required = required;
        this.type = gen_utils_1.tsType(this.schema, options, openApi, model);
        if (((_a = schema) === null || _a === void 0 ? void 0 : _a.nullable) && !this.type.startsWith('null | ')) {
            this.type = 'null | ' + this.type;
        }
        this.identifier = gen_utils_1.escapeId(this.name);
        const description = schema.description || '';
        this.tsComments = gen_utils_1.tsComments(description, 1, schema.deprecated);
    }
}
exports.Property = Property;
//# sourceMappingURL=property.js.map