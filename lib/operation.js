"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Operation = void 0;
const lodash_1 = require("lodash");
const content_1 = require("./content");
const gen_utils_1 = require("./gen-utils");
const operation_variant_1 = require("./operation-variant");
const parameter_1 = require("./parameter");
const security_1 = require("./security");
const request_body_1 = require("./request-body");
const response_1 = require("./response");
/**
 * An operation descriptor
 */
class Operation {
    constructor(openApi, path, pathSpec, method, id, spec, options) {
        this.openApi = openApi;
        this.path = path;
        this.pathSpec = pathSpec;
        this.method = method;
        this.id = id;
        this.spec = spec;
        this.options = options;
        this.parameters = [];
        this.parametersRequired = false;
        this.security = [];
        this.allResponses = [];
        this.variants = [];
        this.path = this.path.replace(/\'/g, '\\\'');
        this.tags = spec.tags || [];
        this.pathVar = `${lodash_1.upperFirst(id)}Path`;
        this.methodName = spec['x-operation-name'] || this.id;
        // Add both the common and specific parameters
        this.parameters = [
            ...this.collectParameters(pathSpec.parameters),
            ...this.collectParameters(spec.parameters),
        ];
        if (this.parameters.find(p => p.required)) {
            this.parametersRequired = true;
        }
        this.hasParameters = this.parameters.length > 0;
        this.security = spec.security ? this.collectSecurity(spec.security) : this.collectSecurity(openApi.security);
        let body = spec.requestBody;
        if (body) {
            if (body.$ref) {
                body = gen_utils_1.resolveRef(this.openApi, body.$ref);
            }
            body = body;
            this.requestBody = new request_body_1.RequestBody(body, this.collectContent(body.content), this.options);
            if (body.required) {
                this.parametersRequired = true;
            }
        }
        const responses = this.collectResponses();
        this.successResponse = responses.success;
        this.allResponses = responses.all;
        this.pathExpression = this.toPathExpression();
        this.deprecated = !!spec.deprecated;
        // Now calculate the variants: request body content x success response content
        this.calculateVariants();
    }
    collectParameters(params) {
        const result = [];
        if (params) {
            for (let param of params) {
                if (param.$ref) {
                    param = gen_utils_1.resolveRef(this.openApi, param.$ref);
                }
                param = param;
                if (param.in === 'cookie') {
                    console.warn(`Ignoring cookie parameter ${this.id}.${param.name} as cookie parameters cannot be sent in XmlHttpRequests.`);
                }
                else if (this.paramIsNotExcluded(param)) {
                    result.push(new parameter_1.Parameter(param, this.options, this.openApi));
                }
            }
        }
        return result;
    }
    collectSecurity(params) {
        if (!params) {
            return [];
        }
        return params.map((param) => {
            return Object.keys(param).map(key => {
                const scope = param[key];
                const security = gen_utils_1.resolveRef(this.openApi, `#/components/securitySchemes/${key}`);
                return new security_1.Security(key, security, scope, this.options, this.openApi);
            });
        });
    }
    paramIsNotExcluded(param) {
        const excludedParameters = this.options.excludeParameters || [];
        return !excludedParameters.includes(param.name);
    }
    collectContent(desc) {
        const result = [];
        if (desc) {
            for (const type of Object.keys(desc)) {
                result.push(new content_1.Content(type, desc[type], this.options, this.openApi));
            }
        }
        return result;
    }
    collectResponses() {
        let successResponse = undefined;
        let responseDesc = undefined;
        const allResponses = [];
        const responses = this.spec.responses || {};
        for (const statusCode of Object.keys(responses)) {
            if (responses[statusCode].$ref) {
                responseDesc = gen_utils_1.resolveRef(this.openApi, responses[statusCode].$ref);
            }
            else {
                responseDesc = responses[statusCode];
            }
            const response = new response_1.Response(statusCode, responseDesc.description || '', this.collectContent(responseDesc.content), this.options);
            allResponses.push(response);
            const statusInt = Number.parseInt(statusCode.trim(), 10);
            if (!successResponse && statusInt >= 200 && statusInt < 300) {
                successResponse = response;
            }
        }
        return { success: successResponse, all: allResponses };
    }
    /**
     * Returns a path expression to be evaluated, for example:
     * "/a/{var1}/b/{var2}/" returns "/a/${params.var1}/b/${params.var2}"
     */
    toPathExpression() {
        return (this.path || '').replace(/\{([^}]+)}/g, (_, pName) => {
            const param = this.parameters.find(p => p.name === pName);
            const paramName = param ? param.var : pName;
            return '${params.' + paramName + '}';
        });
    }
    contentsByMethodPart(hasContent) {
        const map = new Map();
        if (hasContent) {
            const content = hasContent.content;
            if (content && content.length > 0) {
                for (const type of content) {
                    if (type && type.mediaType) {
                        map.set(this.variantMethodPart(type), type);
                    }
                }
            }
        }
        if (map.size === 0) {
            map.set('', null);
        }
        else if (map.size === 1) {
            const content = [...map.values()][0];
            map.clear();
            map.set('', content);
        }
        return map;
    }
    calculateVariants() {
        // It is possible to have multiple content types which end up in the same method.
        // For example: application/json, application/foo-bar+json, text/json ...
        const requestVariants = this.contentsByMethodPart(this.requestBody);
        const responseVariants = this.contentsByMethodPart(this.successResponse);
        requestVariants.forEach((requestContent, requestPart) => {
            responseVariants.forEach((responseContent, responsePart) => {
                const methodName = this.methodName + requestPart + responsePart;
                this.variants.push(new operation_variant_1.OperationVariant(this, methodName, requestContent, responseContent, this.options));
            });
        });
    }
    /**
     * Returns how the given content is represented on the method name
     */
    variantMethodPart(content) {
        if (content) {
            let type = content.mediaType.replace(/\/\*/, '');
            if (type === '*' || type === 'application/octet-stream') {
                return '$Any';
            }
            type = lodash_1.last(type.split('/'));
            const plus = type.lastIndexOf('+');
            if (plus >= 0) {
                type = type.substr(plus + 1);
            }
            return this.options.skipJsonSuffix && type === 'json' ? '' : `$${gen_utils_1.typeName(type)}`;
        }
        else {
            return '';
        }
    }
}
exports.Operation = Operation;
//# sourceMappingURL=operation.js.map