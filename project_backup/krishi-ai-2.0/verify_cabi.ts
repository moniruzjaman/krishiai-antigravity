
import { generateCABITrainingSession } from './services/geminiService';

// Manually setting env because we are running standalone
process.env.VITE_API_KEY = "AIzaSyD-muq8wjKePCEGkco_3a0d8ABIQiY2zto";

// Mock types since we can't easily import them if they are in a central types file that might have other deps
// But here we just pass 'any' where flexible.

const mockAnalysis: any = {
    diagnosis: "Early Blight of Tomato",
    category: "Disease",
    technicalSummary: "Target-like spots with concentric rings on leaves.",
    confidence: 95,
    imageUrl: "https://example.com/test-image.jpg"
};

const runTest = async () => {
    console.log("Starting CABI Backend Verification...");
    try {
        console.log("Calling generateCABITrainingSession...");
        // generateCABITrainingSession(lang: Language, userCrops: UserCrop[], aez: string, analysisResult: any)
        const modules = await generateCABITrainingSession('en', [], 'AEZ-11', mockAnalysis);

        console.log("---------------------------------------------------");
        console.log("Modules generated:", modules.length);

        if (modules.length > 0) {
            console.log("First Module:", modules[0].title);

            const simModule = modules.find(m => m.simulator);
            if (simModule) {
                console.log("Simulator Module found.");
                console.log("Simulator Question:", simModule.simulator?.question);
                console.log("Simulator Image:", simModule.simulator?.image);

                if (simModule.simulator?.image === mockAnalysis.imageUrl) {
                    console.log("✅ SUCCESS: Image passed through correctly.");
                } else {
                    console.error("❌ FAILURE: Image URL mismatch.");
                }

                if (simModule.simulator?.question && simModule.simulator.question !== "Error") {
                    console.log("✅ SUCCESS: Question generated successfully.");
                } else {
                    console.error("❌ FAILURE: Question generation failed.");
                }

            } else {
                console.error("❌ FAILURE: No simulator module found.");
            }

        } else {
            console.error("❌ FAILURE: No modules generated.");
        }
        console.log("---------------------------------------------------");

    } catch (error) {
        console.error("Test Failed with Error:", error);
    }
};

runTest();
