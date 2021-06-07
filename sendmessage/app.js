// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { TABLE_NAME } = process.env;

exports.handler = async (event) => {
  let connectionData;

  try {
    connectionData = await ddb
      .scan({ TableName: TABLE_NAME, ProjectionExpression: "connectionId" })
      .promise();
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  // const postData = JSON.parse(event.body).data;
  // +
  // ":" +
  // event.requestContext.domainName +
  // "/" +
  // event.requestContext.stage +
  // ":" +
  // JSON.stringify(connectionData);

  const sip_OK = `
 SIP/2.0 200 OK
 Via: SIP/2.0/TCP 185.124.7.198:52232;branch=z9hG4bKPj95a239a14ad048579ee715511bab9d30;alias;rport=52232
 From: <sip:302221004624157@52.70.16.226>;tag=dc516931045344cb88d3c349674d0e7c
 To: <sip:302221004624157@52.70.16.226>;tag=a6a1c5f60faecf035a1ae5b6e96e979a-34875ac4
 Call-ID: 36b724dd26a1404ba53e0fbbcb49ec2c
 CSeq: 26945 REGISTER
 Contact:<sip:302221004624157@185.124.7.198:52232;transport=TCP;ob>;reg-id=1;+sip.instance="<urn:uuid:00000000-0000-0000-0000-00003044a718>";expires=3600
 Expires: 3600
 Server: kamailio (5.4.1 (x86_64/linux))
 Content-Length: 0
   `;

  // const postData = sip_OK;

  const postData = JSON.parse(event.body).data;

  const postCalls = connectionData.Items.map(async ({ connectionId }) => {
    try {
      await apigwManagementApi
        .postToConnection({ ConnectionId: connectionId, Data: postData })
        .promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb
          .delete({ TableName: TABLE_NAME, Key: { connectionId } })
          .promise();
      } else {
        throw e;
      }
    }
  });

  try {
    await Promise.all(postCalls);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: "Data sent." };
};
