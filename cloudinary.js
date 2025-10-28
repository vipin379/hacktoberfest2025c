import {v2 as cloudinary} from "cloudinary";
import fs from 'fs';

cloudinary.config({ 
  cloud_name: process.env.CLOUDNINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDNINARY_API_KEY, 
  api_secret: process.env.CLOUDNINARY_API_SECRET
});

const uploadOnCloudinary=async (localFilePath)=>{
    try{
        if(!localFilePath) return null

        // Upload
        const response=await cloudinary.uploader.upload(localFilePath,{
            resource_type: "auto"
        })

        // If correctly Uploaded
        fs.unlinkSync(localFilePath)
        return response
    } catch(error){
        
        // If not correctly uploaded 
        fs.unlinkSync(localFilePath)
        return null;
    }
}

export {uploadOnCloudinary}