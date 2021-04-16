"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationVariant = void 0;
const gen_utils_1 = require("./gen-utils");
/**
 * An operation has a variant per distinct possible body content
 */
class OperationVariant {
    constructor(operation, methodName, requestBody, successResponse, options) {
        this.operation = operation;
        this.methodName = methodName;
        this.requestBody = requestBody;
        this.successResponse = successResponse;
        this.options = options;
        this.responseMethodName = `${methodName}$Response`;
        if (successResponse) {
            this.resultType = successResponse.type;
            this.responseType = this.inferResponseType(successResponse.mediaType, operation, options);
            this.accept = successResponse.mediaType;
        }
        else {
            this.resultType = 'void';
            this.responseType = 'text';
            this.accept = '*/*';
        }
        this.isVoid = this.resultType === 'void';
        this.isNumber = this.resultType === 'number';
        this.isBoolean = this.resultType === 'boolean';
        this.isOther = !this.isVoid && !this.isNumber && !this.isBoolean;
        this.responseMethodTsComments = gen_utils_1.tsComments(this.responseMethodDescription(), 1, operation.deprecated);
        this.bodyMethodTsComments = gen_utils_1.tsComments(this.bodyMethodDescription(), 1, operation.deprecated);
    }
    inferResponseType(mediaType, operation, { customizedResponseType = {} }) {
        const customizedResponseTypeByPath = customizedResponseType[operation.path];
        if (customizedResponseTypeByPath) {
            return customizedResponseTypeByPath.toUse;
        }
        mediaType = mediaType.toLowerCase();
        if (mediaType.includes('/json') || mediaType.includes('+json')) {
            return 'json';
        }
        else if (mediaType.startsWith('text/')) {
            return 'text';
        }
        else {
            return 'blob';
        }
    }
    responseMethodDescription() {
        return `${this.descriptionPrefix()}This method provides access to the full \`HttpResponse\`, allowing access to response headers.
To access only the response body, use \`${this.methodName}()\` instead.${this.descriptionSuffix()}`;
    }
    bodyMethodDescription() {
        return `${this.descriptionPrefix()}This method provides access to only to the response body.
To access the full response (for headers, for example), \`${this.responseMethodName}()\` instead.${this.descriptionSuffix()}`;
    }
    descriptionPrefix() {
        let description = (this.operation.spec.description || '').trim();
        let summary = this.operation.spec.summary;
        if (summary) {
            if (!summary.endsWith('.')) {
                summary += '.';
            }
            description = summary + '\n\n' + description;
        }
        if (description !== '') {
            description += '\n\n';
        }
        return description;
    }
    descriptionSuffix() {
        const sends = this.requestBody ? 'sends `' + this.requestBody.mediaType + '` and ' : '';
        const handles = this.requestBody
            ? `handles request body of type \`${this.requestBody.mediaType}\``
            : 'doesn\'t expect any request body';
        return `\n\nThis method ${sends}${handles}.`;
    }
}
exports.OperationVariant = OperationVariant;
//# sourceMappingURL=operation-variant.js.map
