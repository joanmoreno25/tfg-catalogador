import { S3Client } from "@aws-sdk/client-s3";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { ComprehendClient } from "@aws-sdk/client-comprehend";
// NUEVA RUTA: Librería específica para entornos web
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";

const region = "eu-south-2";

// Obtenemos credenciales temporales limitadas de un solo uso
const credentials = fromCognitoIdentityPool({
  clientConfig: { region },
  identityPoolId: "eu-south-2:e6481dc5-868e-4fa5-9b27-2e9c9fdc130b"
});

export const s3Client = new S3Client({
  region,
  credentials
});

export const rekognitionClient = new RekognitionClient({
  region: "eu-west-1", 
  credentials
});

export const comprehendClient = new ComprehendClient({
  region: "eu-west-1",
  credentials
});

export const BUCKET_NAME = "tfg-joan-moreno";