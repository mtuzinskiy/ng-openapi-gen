"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncDirs = exports.deleteDirRecursive = exports.resolveRef = exports.tsType = exports.escapeId = exports.serviceClass = exports.modelClass = exports.tsComments = exports.toBasicChars = exports.fileName = exports.methodName = exports.enumName = exports.typeName = exports.namespace = exports.modelFile = exports.qualifiedName = exports.unqualifiedName = exports.simpleName = exports.HTTP_METHODS = void 0;
const jsesc_1 = __importDefault(require("jsesc"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const lodash_1 = require("lodash");
exports.HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
/**
 * Returns the simple name, that is, the last part after '/'
 */
function simpleName(name) {
    const pos = name.lastIndexOf('/');
    return name.substring(pos + 1);
}
exports.simpleName = simpleName;
/**
 * Returns the unqualified model class name, that is, the last part after '.'
 */
function unqualifiedName(name, options) {
    const pos = name.lastIndexOf('.');
    return modelClass(name.substring(pos + 1), options);
}
exports.unqualifiedName = unqualifiedName;
/**
 * Returns the qualified model class name, that is, the camelized namespace (if any) plus the unqualified name
 */
function qualifiedName(name, options) {
    const ns = namespace(name);
    const unq = unqualifiedName(name, options);
    return ns ? typeName(ns) + unq : unq;
}
exports.qualifiedName = qualifiedName;
/**
 * Returns the file to import for a given model
 */
function modelFile(pathToModels, name, options) {
    let dir = pathToModels || '';
    if (dir.endsWith('/')) {
        dir = dir.substr(0, dir.length - 1);
    }
    const ns = namespace(name);
    if (ns) {
        dir += `/${ns}`;
    }
    const file = unqualifiedName(name, options);
    return dir += '/' + fileName(file);
}
exports.modelFile = modelFile;
/**
 * Returns the namespace path, that is, the part before the last '.' split by '/' instead of '.'.
 * If there's no namespace, returns undefined.
 */
function namespace(name) {
    name = name.replace(/^\.+/g, '');
    name = name.replace(/\.+$/g, '');
    const pos = name.lastIndexOf('.');
    return pos < 0 ? undefined : name.substring(0, pos).replace(/\./g, '/');
}
exports.namespace = namespace;
/**
 * Returns the type (class) name for a given regular name
 */
function typeName(name) {
    return lodash_1.upperFirst(methodName(name));
}
exports.typeName = typeName;
/**
 * Returns the name of the enum constant for a given value
 */
function enumName(value, options) {
    let name = toBasicChars(value, true);
    if (options.enumStyle === 'upper') {
        name = lodash_1.upperCase(name).replace(/\s+/g, '_');
    }
    else {
        name = lodash_1.upperFirst(lodash_1.camelCase(name));
    }
    if (/^\d/.test(name)) {
        name = '$' + name;
    }
    return name;
}
exports.enumName = enumName;
/**
 * Returns a suitable method name for the given name
 * @param name The raw name
 */
function methodName(name) {
    return lodash_1.camelCase(toBasicChars(name, true));
}
exports.methodName = methodName;
/**
 * Returns the file name for a given type name
 */
function fileName(text) {
    return lodash_1.kebabCase(toBasicChars(text));
}
exports.fileName = fileName;
/**
 * Converts a text to a basic, letters / numbers / underscore representation.
 * When firstNonDigit is true, prepends the result with an uderscore if the first char is a digit.
 */
function toBasicChars(text, firstNonDigit = false) {
    text = lodash_1.deburr((text || '').trim());
    text = text.replace(/[^\w]+/g, '_');
    if (firstNonDigit && /[0-9]/.test(text.charAt(0))) {
        text = '_' + text;
    }
    return text;
}
exports.toBasicChars = toBasicChars;
/**
 * Returns the TypeScript comments for the given schema description, in a given indentation level
 */
function tsComments(description, level, deprecated) {
    const indent = '  '.repeat(level);
    if (description == undefined || description.length === 0) {
        return indent + (deprecated ? '/** @deprecated */' : '');
    }
    const lines = description.trim().split('\n');
    let result = '\n' + indent + '/**\n';
    lines.forEach(line => {
        result += indent + ' *' + (line === '' ? '' : ' ' + line.replace(/\*\//g, '* / ')) + '\n';
    });
    if (deprecated) {
        result += indent + ' *\n' + indent + ' * @deprecated\n';
    }
    result += indent + ' */\n' + indent;
    return result;
}
exports.tsComments = tsComments;
/**
 * Applies the prefix and suffix to a model class name
 */
function modelClass(baseName, options) {
    return `${options.modelPrefix || ''}${typeName(baseName)}${options.modelSuffix || ''}`;
}
exports.modelClass = modelClass;
/**
 * Applies the prefix and suffix to a service class name
 */
function serviceClass(baseName, options) {
    return `${options.servicePrefix || ''}${typeName(baseName)}${options.serviceSuffix || 'Service'}`;
}
exports.serviceClass = serviceClass;
/**
 * Escapes the name of a property / parameter if not valid JS identifier
 */
function escapeId(name) {
    if (/^[a-zA-Z]\w+$/.test(name)) {
        return name;
    }
    else {
        return `'${name.replace(/\'/g, '\\\'')}'`;
    }
}
exports.escapeId = escapeId;
/**
 * Returns the TypeScript type for the given type and options
 */
function tsType(schemaOrRef, options, openApi, container) {
    if (!schemaOrRef) {
        // No schema
        return 'any';
    }
    if (schemaOrRef.$ref) {
        // A reference
        const resolved = resolveRef(openApi, schemaOrRef.$ref);
        const nullable = !!(resolved && resolved.nullable);
        const prefix = nullable ? 'null | ' : '';
        const name = simpleName(schemaOrRef.$ref);
        if (container && container.name === name) {
            // When referencing the same container, use its type name
            return prefix + container.typeName;
        }
        else {
            return prefix + qualifiedName(name, options);
        }
    }
    const schema = schemaOrRef;
    // An union of types
    const union = schema.oneOf || schema.anyOf || [];
    if (union.length > 0) {
        if (union.length > 1) {
            return `(${union.map(u => tsType(u, options, openApi, container)).join(' | ')})`;
        }
        else {
            return union.map(u => tsType(u, options, openApi, container)).join(' | ');
        }
    }
    const type = schema.type || 'any';
    // An array
    if (type === 'array' || schema.items) {
        return `Array<${tsType(schema.items || {}, options, openApi, container)}>`;
    }
    // All the types
    const allOf = schema.allOf || [];
    let intersectionType = [];
    if (allOf.length > 0) {
        intersectionType = allOf.map(u => tsType(u, options, openApi, container));
    }
    // An object
    if (type === 'object' || schema.properties) {
        let result = '{ ';
        let first = true;
        const properties = schema.properties || {};
        const required = schema.required;
        for (const propName of Object.keys(properties)) {
            const property = properties[propName];
            if (!property) {
                continue;
            }
            const propRequired = required && required.includes(propName);
            if (first) {
                first = false;
            }
            else {
                result += ', ';
            }
            result += `'${propName}'`;
            if (!propRequired) {
                result += '?';
            }
            let propertyType = tsType(property, options, openApi, container);
            if (property.nullable) {
                propertyType = `${propertyType} | null`;
            }
            result += `: ${propertyType}`;
        }
        if (schema.additionalProperties) {
            const additionalProperties = schema.additionalProperties === true ? {} : schema.additionalProperties;
            if (!first) {
                result += ', ';
            }
            result += `[key: string]: ${tsType(additionalProperties, options, openApi, container)}`;
        }
        result += ' }';
        intersectionType.push(result);
    }
    if (intersectionType.length > 0) {
        return intersectionType.join(' & ');
    }
    // Inline enum
    const enumValues = schema.enum || [];
    if (enumValues.length > 0) {
        if (type === 'number' || type === 'integer' || type === 'boolean') {
            return enumValues.join(' | ');
        }
        else {
            return enumValues.map(v => `'${jsesc_1.default(v)}'`).join(' | ');
        }
    }
    // A Blob
    if (type === 'string' && schema.format === 'binary') {
        return 'Blob';
    }
    // A simple type
    return type === 'integer' ? 'number' : type;
}
exports.tsType = tsType;
/**
 * Resolves a reference
 * @param ref The reference name, such as #/components/schemas/Name, or just Name
 */
function resolveRef(openApi, ref) {
    if (!ref.includes('/')) {
        ref = `#/components/schemas/${ref}`;
    }
    let current = null;
    for (let part of ref.split('/')) {
        part = part.trim();
        if (part === '#' || part === '') {
            current = openApi;
        }
        else if (current == null) {
            break;
        }
        else {
            current = current[part];
        }
    }
    if (current == null || typeof current !== 'object') {
        throw new Error(`Couldn't resolve reference ${ref}`);
    }
    return current;
}
exports.resolveRef = resolveRef;
/**
 * Recursively deletes a directory
 */
function deleteDirRecursive(dir) {
    if (fs_extra_1.default.existsSync(dir)) {
        fs_extra_1.default.readdirSync(dir).forEach((file) => {
            const curPath = path_1.default.join(dir, file);
            if (fs_extra_1.default.lstatSync(curPath).isDirectory()) { // recurse
                deleteDirRecursive(curPath);
            }
            else { // delete file
                fs_extra_1.default.unlinkSync(curPath);
            }
        });
        fs_extra_1.default.rmdirSync(dir);
    }
}
exports.deleteDirRecursive = deleteDirRecursive;
/**
 * Synchronizes the files from the source to the target directory. Optionally remove stale files.
 */
function syncDirs(srcDir, destDir, removeStale) {
    fs_extra_1.default.ensureDirSync(destDir);
    const srcFiles = fs_extra_1.default.readdirSync(srcDir);
    const destFiles = fs_extra_1.default.readdirSync(destDir);
    for (const file of srcFiles) {
        const srcFile = path_1.default.join(srcDir, file);
        const destFile = path_1.default.join(destDir, file);
        if (fs_extra_1.default.lstatSync(srcFile).isDirectory()) {
            // A directory: recursively sync
            syncDirs(srcFile, destFile, removeStale);
        }
        else {
            // Read the content of both files and update if they differ
            const srcContent = fs_extra_1.default.readFileSync(srcFile, { encoding: 'utf-8' });
            const destContent = fs_extra_1.default.existsSync(destFile) ? fs_extra_1.default.readFileSync(destFile, { encoding: 'utf-8' }) : null;
            if (srcContent !== destContent) {
                fs_extra_1.default.writeFileSync(destFile, srcContent, { encoding: 'utf-8' });
                console.debug('Wrote ' + destFile);
            }
        }
    }
    if (removeStale) {
        for (const file of destFiles) {
            const srcFile = path_1.default.join(srcDir, file);
            const destFile = path_1.default.join(destDir, file);
            if (!fs_extra_1.default.existsSync(srcFile) && fs_extra_1.default.lstatSync(destFile).isFile()) {
                fs_extra_1.default.unlinkSync(destFile);
                console.debug('Removed stale file ' + destFile);
            }
        }
    }
}
exports.syncDirs = syncDirs;
//# sourceMappingURL=gen-utils.js.map