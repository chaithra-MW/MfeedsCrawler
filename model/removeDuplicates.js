module.exports = function removeDuplicates(schema) {
    schema.pre('save', async function (next) {
        try {
            const Model = this.constructor; // Get the model dynamically
            const existingDoc = await Model.findOne({ url: this.url });

            if (existingDoc) {
                console.warn(`Duplicate URL detected: ${this.url}`);
                return next(new Error('Duplicate URL detected')); // Prevent saving duplicate
            }
            
            next();
        } catch (error) {
            next(error);
        }
    });
};
